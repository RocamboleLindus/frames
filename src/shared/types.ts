export interface ImageRecord {
  path: string
  name: string
  ext: string
  size: number
  createdAt: number
  modifiedAt: number
  thumbUrl: string
  heroUrl: string
  fullUrl: string
}

export interface FolderRecord {
  path: string
  name: string
  images: ImageRecord[]
  error?: string
}

export interface ImageDetails {
  path: string
  name: string
  ext: string
  size: number
  createdAt: number
  modifiedAt: number
  width: number | null
  height: number | null
  camera?: string
  lens?: string
  exposure?: string
  iso?: string
  gps?: string
  takenAt?: number
}

export interface UpdateOutcome {
  state: 'current' | 'dev' | 'installing'
  version: string
  latest?: string
}

export interface FramesApi {
  getLibrary(): Promise<FolderRecord[]>
  addFolders(): Promise<FolderRecord[]>
  removeFolder(folderPath: string): Promise<FolderRecord[]>
  refresh(): Promise<FolderRecord[]>
  getDetails(filePath: string): Promise<ImageDetails>
  showInFolder(filePath: string): Promise<void>
  getVersion(): Promise<string>
  updateApp(): Promise<UpdateOutcome>
}

const TYPE_LABELS: Record<string, string> = {
  '.jpg': 'JPEG',
  '.jpeg': 'JPEG',
  '.jpe': 'JPEG',
  '.jfif': 'JPEG',
  '.png': 'PNG',
  '.gif': 'GIF',
  '.webp': 'WebP',
  '.bmp': 'BMP',
  '.tif': 'TIFF',
  '.tiff': 'TIFF',
  '.avif': 'AVIF'
}

export const SUPPORTED_LABELS = ['JPG', 'PNG', 'GIF', 'WebP', 'BMP', 'TIFF', 'AVIF']

const IMAGE_EXTENSIONS = new Set(Object.keys(TYPE_LABELS))

export function isImageFileName(name: string): boolean {
  const dot = name.lastIndexOf('.')
  if (dot < 0) return false
  return IMAGE_EXTENSIONS.has(name.slice(dot).toLowerCase())
}

export function typeLabel(ext: string): string {
  return TYPE_LABELS[ext.toLowerCase()] ?? ext.replace(/^\./, '').toUpperCase()
}
