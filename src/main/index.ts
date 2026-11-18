import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { app, BrowserWindow, Menu, ipcMain, protocol, screen } from 'electron'
import * as library from './library'
import { getRendition, pruneThumbs } from './thumbs'
import { installUpdate } from './updater'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
])

if (!app.isPackaged) {
  app.setPath('userData', join(process.cwd(), '.userdata'))
}

let mainWindow: BrowserWindow | null = null

function mimeFor(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case '.png':
      return 'image/png'
    case '.gif':
      return 'image/gif'
    case '.webp':
      return 'image/webp'
    case '.bmp':
      return 'image/bmp'
    case '.avif':
      return 'image/avif'
    case '.tif':
    case '.tiff':
      return 'image/tiff'
    default:
      return 'image/jpeg'
  }
}

function readMediaUrl(requestUrl: string): { kind: 'thumb' | 'hero' | 'full'; filePath: string } | null {
  let url: URL
  try {
    url = new URL(requestUrl)
  } catch {
    return null
  }
  const kind = url.pathname.replace(/^\//, '')
  const filePath = url.searchParams.get('path')
  if (!filePath || (kind !== 'thumb' && kind !== 'hero' && kind !== 'full')) return null
  return { kind, filePath }
}

async function serveFile(filePath: string): Promise<Response> {
  const bytes = await readFile(filePath)
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': mimeFor(filePath),
      'Cache-Control': 'public, max-age=3600'
    }
  })
}

async function handleMedia(request: Request): Promise<Response> {
  const parsed = readMediaUrl(request.url)
  if (!parsed) return new Response('Bad request', { status: 400 })
  if (!(await library.isAllowedFile(parsed.filePath))) return new Response('Forbidden', { status: 403 })
  if (parsed.kind === 'full') return serveFile(parsed.filePath)
  const bytes = await getRendition(parsed.filePath, parsed.kind)
  if (!bytes) return serveFile(parsed.filePath)
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  })
}

function appIcon(): string | undefined {
  const candidates = [join(process.resourcesPath, 'icon.png'), join(process.cwd(), 'build', 'icon.png')]
  return candidates.find((candidate) => existsSync(candidate))
}

function createWindow(): void {
  const area = screen.getPrimaryDisplay().workArea
  const width = Math.min(1440, area.width)
  const height = Math.min(900, area.height)
  const icon = appIcon()
  const win = new BrowserWindow({
    x: area.x + Math.round((area.width - width) / 2),
    y: area.y + Math.round((area.height - height) / 2),
    width,
    height,
    ...(icon ? { icon } : {}),
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#141414',
    autoHideMenuBar: true,
    title: 'Frames',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  mainWindow = win
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env.ELECTRON_RENDERER_URL
    if (devUrl && url.startsWith(devUrl)) return
    if (url.startsWith('file://')) return
    event.preventDefault()
  })
  win.webContents.on('console-message', (...args: unknown[]) => {
    const details = args[1] as { level?: number; message?: string } | number | undefined
    const level = typeof details === 'number' ? details : details?.level
    const message = typeof args[2] === 'string' ? args[2] : typeof details === 'object' ? details?.message : undefined
    if (typeof level === 'number' && level >= 2 && message) console.log(`[renderer] ${message}`)
  })
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    const key = input.key.toLowerCase()
    if (key === 'f12' || (input.control && input.shift && key === 'i')) {
      win.webContents.toggleDevTools()
      event.preventDefault()
    }
  })
  const show = (): void => {
    if (!win.isDestroyed() && !win.isVisible()) win.show()
  }
  win.once('ready-to-show', show)
  setTimeout(show, 4000)
  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.setName('Frames')
app.setAppUserModelId('app.frames.viewer')
Menu.setApplicationMenu(null)

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })
}

void app.whenReady().then(async () => {
  if (!gotLock) return
  try {
    await library.init()
  } catch (error) {
    console.error('[frames] init failed', error)
  }
  protocol.handle('media', async (request) => {
    try {
      return await handleMedia(request)
    } catch (error) {
      console.error('[frames] media failed', error)
      return new Response('Media error', { status: 500 })
    }
  })
  ipcMain.handle('library:get', () => library.list())
  ipcMain.handle('library:add', () => {
    if (!mainWindow) throw new Error('The window is not ready.')
    return library.addFolders(mainWindow)
  })
  ipcMain.handle('library:remove', (_event, folderPath: unknown) => {
    if (typeof folderPath !== 'string') throw new Error('Missing folder.')
    return library.removeFolder(folderPath)
  })
  ipcMain.handle('library:refresh', () => library.refresh())
  ipcMain.handle('image:details', (_event, filePath: unknown) => {
    if (typeof filePath !== 'string') throw new Error('Missing file path.')
    return library.getDetails(filePath)
  })
  ipcMain.handle('image:show', (_event, filePath: unknown) => {
    if (typeof filePath !== 'string') throw new Error('Missing file path.')
    return library.showInFolder(filePath)
  })
  ipcMain.handle('app:version', () => app.getVersion())
  ipcMain.handle('app:update', () => installUpdate())
  createWindow()
  void pruneThumbs()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
