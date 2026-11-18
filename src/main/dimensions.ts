import sizeOfImport from 'image-size'

interface SizeResult {
  width?: number
  height?: number
}

type SizeFn = (input: string) => SizeResult

function resolveSizeFn(imported: unknown): SizeFn | null {
  if (typeof imported === 'function') return imported as SizeFn
  if (imported && typeof imported === 'object' && 'default' in imported) {
    const nested = (imported as { default?: unknown }).default
    if (typeof nested === 'function') return nested as SizeFn
  }
  return null
}

const sizeOf = resolveSizeFn(sizeOfImport)

export function readDimensions(filePath: string): { width: number; height: number } | null {
  if (!sizeOf) return null
  try {
    const result = sizeOf(filePath)
    if (!result.width || !result.height) return null
    return { width: result.width, height: result.height }
  } catch {
    return null
  }
}
