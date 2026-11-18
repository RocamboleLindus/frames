import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, nativeImage, type NativeImage } from 'electron'
import { readOrientation } from './exif'
import { orientBitmap } from './orient'

const inflight = new Map<string, Promise<Buffer | null>>()
let chain: Promise<unknown> = Promise.resolve()
let directoryReady: Promise<string> | null = null

function enqueue<T>(work: () => T): Promise<T> {
  const run = chain.then(
    () =>
      new Promise<T>((resolve, reject) => {
        setImmediate(() => {
          try {
            resolve(work())
          } catch (error) {
            reject(error)
          }
        })
      })
  )
  chain = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

function thumbDir(): string {
  return join(app.getPath('userData'), 'thumbs')
}

function ensureDir(): Promise<string> {
  if (!directoryReady) {
    const dir = thumbDir()
    directoryReady = mkdir(dir, { recursive: true }).then(() => dir)
  }
  return directoryReady
}

function cacheId(kind: string, filePath: string, mtimeMs: number): string {
  const identity = process.platform === 'win32' ? filePath.toLowerCase() : filePath
  return createHash('sha1').update(`v1|${kind}|${identity}|${Math.round(mtimeMs)}`).digest('hex')
}

function fit(image: NativeImage, maxEdge: number): NativeImage {
  const size = image.getSize()
  const longest = Math.max(size.width, size.height)
  if (longest <= maxEdge || longest === 0) return image
  const scale = maxEdge / longest
  return image.resize({
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
    quality: 'good'
  })
}

function renderSync(filePath: string, kind: 'thumb' | 'hero', orientation: number): Buffer | null {
  try {
    const image = nativeImage.createFromPath(filePath)
    if (image.isEmpty()) return null
    const fitted = fit(image, kind === 'hero' ? 1600 : 480)
    const quality = kind === 'hero' ? 82 : 74
    const size = fitted.getSize(1)
    const bitmap = fitted.toBitmap({ scaleFactor: 1 })
    if (orientation === 1 || bitmap.length !== size.width * size.height * 4 || bitmap.byteOffset % 4 !== 0) {
      return fitted.toJPEG(quality)
    }
    const turned = orientBitmap(bitmap, size.width, size.height, orientation)
    const rotated = nativeImage.createFromBitmap(turned.buffer, {
      width: turned.width,
      height: turned.height,
      scaleFactor: 1
    })
    if (rotated.isEmpty()) return fitted.toJPEG(quality)
    return rotated.toJPEG(quality)
  } catch (error) {
    console.error('[frames] thumb failed', filePath, error)
    return null
  }
}

async function produce(filePath: string, kind: 'thumb' | 'hero', cacheFile: string): Promise<Buffer | null> {
  try {
    return await readFile(cacheFile)
  } catch {
    // Cache miss. Render below.
  }
  const orientation = await readOrientation(filePath)
  const bytes = await enqueue(() => renderSync(filePath, kind, orientation))
  if (!bytes) return null
  await writeFile(cacheFile, bytes).catch(() => undefined)
  return bytes
}

export async function getRendition(filePath: string, kind: 'thumb' | 'hero'): Promise<Buffer | null> {
  try {
    return await renderCached(filePath, kind)
  } catch (error) {
    console.error('[frames] rendition failed', filePath, error)
    return null
  }
}

async function renderCached(filePath: string, kind: 'thumb' | 'hero'): Promise<Buffer | null> {
  const [dir, info] = await Promise.all([ensureDir(), stat(filePath)])
  const key = cacheId(kind, filePath, info.mtimeMs)
  const existing = inflight.get(key)
  if (existing) return existing
  const cacheFile = join(dir, `${key}.jpg`)
  const job = produce(filePath, kind, cacheFile)
  inflight.set(key, job)
  try {
    return await job
  } finally {
    inflight.delete(key)
  }
}

export async function pruneThumbs(): Promise<void> {
  const dir = await ensureDir()
  const names = await readdir(dir).catch(() => [])
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000
  await Promise.all(
    names.map(async (name) => {
      const full = join(dir, name)
      const info = await stat(full).catch(() => null)
      if (info && info.mtimeMs < cutoff) await unlink(full).catch(() => undefined)
    })
  )
}
