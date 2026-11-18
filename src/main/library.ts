import { mkdir, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join, resolve, sep } from 'node:path'
import { app, dialog, shell, type BrowserWindow } from 'electron'
import { isImageFileName, type FolderRecord, type ImageDetails, type ImageRecord } from '../shared/types'
import { readDimensions } from './dimensions'
import { orientedSize, readExif } from './exif'

const cache = new Map<string, FolderRecord>()
let folderPaths: string[] = []

function libraryFile(): string {
  return join(app.getPath('userData'), 'library.json')
}

function pathKey(filePath: string): string {
  const resolved = resolve(filePath)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

function samePath(a: string, b: string): boolean {
  return pathKey(a) === pathKey(b)
}

function isInside(file: string, root: string): boolean {
  const child = process.platform === 'win32' ? resolve(file).toLowerCase() : resolve(file)
  const parent = process.platform === 'win32' ? resolve(root).toLowerCase() : resolve(root)
  if (child === parent) return false
  const prefix = parent.endsWith(sep) ? parent : parent + sep
  return child.startsWith(prefix)
}

function stripExtendedPrefix(filePath: string): string {
  if (filePath.startsWith('\\\\?\\UNC\\')) return `\\\\${filePath.slice(8)}`
  if (filePath.startsWith('\\\\?\\')) return filePath.slice(4)
  return filePath
}

function mediaUrl(kind: 'thumb' | 'hero' | 'full', filePath: string, version: number): string {
  return `media://local/${kind}?path=${encodeURIComponent(filePath)}&v=${Math.round(version)}`
}

function toRecord(filePath: string, info: { size: number; birthtimeMs: number; ctimeMs: number; mtimeMs: number }): ImageRecord {
  return {
    path: filePath,
    name: basename(filePath),
    ext: extname(filePath).toLowerCase(),
    size: info.size,
    createdAt: info.birthtimeMs > 0 ? info.birthtimeMs : info.ctimeMs,
    modifiedAt: info.mtimeMs,
    thumbUrl: mediaUrl('thumb', filePath, info.mtimeMs),
    heroUrl: mediaUrl('hero', filePath, info.mtimeMs),
    fullUrl: mediaUrl('full', filePath, info.mtimeMs)
  }
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  if (items.length === 0) return []
  const results = new Array<R>(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const current = next
      next += 1
      results[current] = await fn(items[current])
    }
  })
  await Promise.all(workers)
  return results
}

async function readSavedFolders(): Promise<string[]> {
  let raw: string
  try {
    raw = await readFile(libraryFile(), 'utf8')
  } catch {
    return []
  }
  try {
    const parsed = JSON.parse(raw) as { folders?: unknown }
    if (!Array.isArray(parsed.folders)) return []
    return parsed.folders.filter((folder): folder is string => typeof folder === 'string').map((folder) => resolve(folder))
  } catch {
    await writeFile(`${libraryFile()}.bak`, raw).catch(() => undefined)
    return []
  }
}

async function saveFolders(): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(libraryFile(), JSON.stringify({ folders: folderPaths }, null, 2), 'utf8')
}

async function actuallyScan(folderPath: string): Promise<FolderRecord> {
  const name = basename(folderPath) || folderPath
  try {
    const entries = await readdir(folderPath, { withFileTypes: true })
    const files = entries.filter((entry) => entry.isFile() && !entry.name.startsWith('.') && isImageFileName(entry.name))
    const images = (
      await mapPool(files, 24, async (entry) => {
        const filePath = join(folderPath, entry.name)
        try {
          const info = await stat(filePath)
          if (!info.isFile() || info.size <= 0) return null
          return toRecord(filePath, info)
        } catch {
          return null
        }
      })
    ).filter((image): image is ImageRecord => image !== null)
    images.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
    return { path: folderPath, name, images }
  } catch {
    return {
      path: folderPath,
      name,
      images: [],
      error: 'This folder is missing or cannot be read.'
    }
  }
}

async function scanOrError(folderPath: string, force: boolean): Promise<FolderRecord> {
  const key = pathKey(folderPath)
  if (!force) {
    const cached = cache.get(key)
    if (cached) return cached
  }
  const row = await actuallyScan(folderPath)
  cache.set(key, row)
  return row
}

export async function init(): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true })
  folderPaths = await readSavedFolders()
}

export async function list(force = false): Promise<FolderRecord[]> {
  const rows: FolderRecord[] = []
  for (const folderPath of folderPaths) {
    rows.push(await scanOrError(folderPath, force))
  }
  return rows
}

export async function addFolders(win: BrowserWindow): Promise<FolderRecord[]> {
  const picked = await dialog.showOpenDialog(win, {
    title: 'Add a folder',
    buttonLabel: 'Add folder',
    properties: ['openDirectory', 'multiSelections']
  })
  if (picked.canceled || picked.filePaths.length === 0) return list()
  const fresh: string[] = []
  let sawDirectory = false
  for (const candidate of picked.filePaths) {
    try {
      const info = await stat(candidate)
      if (!info.isDirectory()) continue
      sawDirectory = true
    } catch {
      continue
    }
    const resolved = resolve(candidate)
    if (folderPaths.some((folder) => samePath(folder, resolved)) || fresh.some((folder) => samePath(folder, resolved))) continue
    fresh.push(resolved)
  }
  if (fresh.length === 0) {
    throw new Error(sawDirectory ? 'That folder is already in the library.' : 'Choose a folder of images.')
  }
  folderPaths = [...fresh, ...folderPaths]
  await saveFolders()
  return list()
}

export async function removeFolder(folderPath: string): Promise<FolderRecord[]> {
  if (typeof folderPath !== 'string') throw new Error('Missing folder.')
  folderPaths = folderPaths.filter((folder) => !samePath(folder, folderPath))
  cache.delete(pathKey(folderPath))
  await saveFolders()
  return list()
}

export async function refresh(): Promise<FolderRecord[]> {
  cache.clear()
  return list(true)
}

export async function isAllowedFile(filePath: string): Promise<boolean> {
  if (typeof filePath !== 'string' || filePath.length === 0) return false
  const resolved = resolve(filePath)
  if (!folderPaths.some((root) => isInside(resolved, root))) return false
  let realFile: string
  try {
    const info = await stat(resolved)
    if (!info.isFile() || info.size <= 0) return false
    realFile = stripExtendedPrefix(await realpath(resolved))
  } catch {
    return false
  }
  for (const root of folderPaths) {
    let realRoot = root
    try {
      realRoot = stripExtendedPrefix(await realpath(root))
    } catch {
      realRoot = root
    }
    if (isInside(realFile, realRoot)) return true
  }
  return false
}

export async function getDetails(filePath: string): Promise<ImageDetails> {
  if (!(await isAllowedFile(filePath))) throw new Error('That file is not in the library.')
  const resolved = resolve(filePath)
  const info = await stat(resolved)
  const exif = await readExif(resolved)
  const stored = readDimensions(resolved)
  const display = stored ? orientedSize(stored.width, stored.height, exif.orientation) : null
  const details: ImageDetails = {
    path: resolved,
    name: basename(resolved),
    ext: extname(resolved).toLowerCase(),
    size: info.size,
    createdAt: info.birthtimeMs > 0 ? info.birthtimeMs : info.ctimeMs,
    modifiedAt: info.mtimeMs,
    width: display?.width ?? null,
    height: display?.height ?? null
  }
  if (exif.camera) details.camera = exif.camera
  if (exif.lens) details.lens = exif.lens
  if (exif.exposure) details.exposure = exif.exposure
  if (exif.iso) details.iso = exif.iso
  if (exif.gps) details.gps = exif.gps
  if (exif.takenAt) details.takenAt = exif.takenAt
  return details
}

export async function showInFolder(filePath: string): Promise<void> {
  if (!(await isAllowedFile(filePath))) throw new Error('That file is not in the library.')
  shell.showItemInFolder(resolve(filePath))
}
