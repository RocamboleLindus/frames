import exifr from 'exifr'
import { swapsAxes } from './orient'

export interface ExifSummary {
  orientation: number
  camera?: string
  lens?: string
  exposure?: string
  iso?: string
  gps?: string
  takenAt?: number
}

function clean(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = value.replace(/\0/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text || text === '----' || text.toLowerCase() === 'unknown') return undefined
  return text
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function trimNumber(value: number): string {
  return (Math.round(value * 10) / 10).toString()
}

function formatShutter(seconds: number): string {
  if (seconds >= 1) return `${trimNumber(seconds)} s`
  const denominator = Math.max(1, Math.round(1 / seconds))
  return `1/${denominator} s`
}

function formatExposure(time: unknown, fNumber: unknown): string | undefined {
  const parts: string[] = []
  if (typeof time === 'string' && time.includes('/')) {
    const shutter = time.trim()
    parts.push(shutter.endsWith('s') ? shutter : `${shutter} s`)
  } else {
    const seconds = asNumber(time)
    if (seconds != null && seconds > 0) parts.push(formatShutter(seconds))
  }
  const aperture = asNumber(fNumber)
  if (aperture != null && aperture > 0) parts.push(`f/${trimNumber(aperture)}`)
  return parts.length > 0 ? parts.join(' · ') : undefined
}

function formatGps(latitude: number, longitude: number): string {
  const northSouth = latitude >= 0 ? 'N' : 'S'
  const eastWest = longitude >= 0 ? 'E' : 'W'
  return `${Math.abs(latitude).toFixed(5)}° ${northSouth}, ${Math.abs(longitude).toFixed(5)}° ${eastWest}`
}

function parseTaken(value: unknown): number | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime()
  if (typeof value !== 'string') return undefined
  const match = value.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
  if (match) {
    const [, year, month, day, hour, minute, second] = match
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    ).getTime()
  }
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

function cameraName(make: string | undefined, model: string | undefined): string | undefined {
  if (make && model) {
    return model.toLowerCase().startsWith(make.toLowerCase()) ? model : `${make} ${model}`
  }
  return model || make
}

function lensName(make: string | undefined, model: string | undefined): string | undefined {
  if (make && model && !model.toLowerCase().includes(make.toLowerCase())) return `${make} ${model}`
  return model || make
}

export async function readOrientation(filePath: string): Promise<number> {
  try {
    const value = await exifr.orientation(filePath)
    return typeof value === 'number' && value >= 1 && value <= 8 ? value : 1
  } catch {
    return 1
  }
}

export async function readExif(filePath: string): Promise<ExifSummary> {
  const orientation = await readOrientation(filePath)
  try {
    const data = await exifr.parse(filePath, {
      gps: true,
      translateKeys: true,
      translateValues: true,
      reviveValues: true
    })
    if (!data || typeof data !== 'object') return { orientation }
    const record = data as Record<string, unknown>
    const summary: ExifSummary = { orientation }
    const camera = cameraName(clean(record.Make), clean(record.Model))
    const lens = lensName(clean(record.LensMake), clean(record.LensModel))
    const exposure = formatExposure(record.ExposureTime, record.FNumber)
    const isoValue = asNumber(record.ISO ?? record.ISOSpeedRatings ?? record.PhotographicSensitivity)
    const latitude = asNumber(record.latitude ?? record.Latitude)
    const longitude = asNumber(record.longitude ?? record.Longitude)
    const takenAt = parseTaken(record.DateTimeOriginal ?? record.CreateDate)
    if (camera) summary.camera = camera
    if (lens) summary.lens = lens
    if (exposure) summary.exposure = exposure
    if (isoValue != null) summary.iso = String(Math.round(isoValue))
    if (latitude != null && longitude != null) summary.gps = formatGps(latitude, longitude)
    if (takenAt != null) summary.takenAt = takenAt
    return summary
  } catch (error) {
    console.error('[frames] exif', filePath, error)
    return { orientation }
  }
}

export function orientedSize(width: number, height: number, orientation: number): { width: number; height: number } {
  return swapsAxes(orientation) ? { width: height, height: width } : { width, height }
}
