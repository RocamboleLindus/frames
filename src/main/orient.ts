export interface OrientedBitmap {
  buffer: Buffer
  width: number
  height: number
}

function pixels(buffer: Buffer): Uint32Array {
  return new Uint32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4)
}

function rotate90CW(src: Buffer, width: number, height: number): OrientedBitmap {
  const dst = Buffer.allocUnsafe(src.length)
  const from = pixels(src)
  const to = pixels(dst)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      to[x * height + (height - 1 - y)] = from[y * width + x]
    }
  }
  return { buffer: dst, width: height, height: width }
}

function rotate90CCW(src: Buffer, width: number, height: number): OrientedBitmap {
  const dst = Buffer.allocUnsafe(src.length)
  const from = pixels(src)
  const to = pixels(dst)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      to[(width - 1 - x) * height + y] = from[y * width + x]
    }
  }
  return { buffer: dst, width: height, height: width }
}

function rotate180(src: Buffer, width: number, height: number): OrientedBitmap {
  const dst = Buffer.allocUnsafe(src.length)
  const from = pixels(src)
  const to = pixels(dst)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      to[(height - 1 - y) * width + (width - 1 - x)] = from[y * width + x]
    }
  }
  return { buffer: dst, width, height }
}

function flipHorizontal(src: Buffer, width: number, height: number): OrientedBitmap {
  const dst = Buffer.allocUnsafe(src.length)
  const from = pixels(src)
  const to = pixels(dst)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      to[y * width + (width - 1 - x)] = from[y * width + x]
    }
  }
  return { buffer: dst, width, height }
}

function flipVertical(src: Buffer, width: number, height: number): OrientedBitmap {
  const dst = Buffer.allocUnsafe(src.length)
  const from = pixels(src)
  const to = pixels(dst)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      to[(height - 1 - y) * width + x] = from[y * width + x]
    }
  }
  return { buffer: dst, width, height }
}

// EXIF orientation values describe how to turn the stored pixels upright:
// 1 as stored, 2 flip horizontal, 3 rotate 180, 4 flip vertical,
// 5 flip horizontal then rotate 270 clockwise, 6 rotate 90 clockwise,
// 7 flip horizontal then rotate 90 clockwise, 8 rotate 90 counter-clockwise.
export function orientBitmap(src: Buffer, width: number, height: number, orientation: number): OrientedBitmap {
  switch (orientation) {
    case 2:
      return flipHorizontal(src, width, height)
    case 3:
      return rotate180(src, width, height)
    case 4:
      return flipVertical(src, width, height)
    case 5: {
      const flipped = flipHorizontal(src, width, height)
      return rotate90CCW(flipped.buffer, flipped.width, flipped.height)
    }
    case 6:
      return rotate90CW(src, width, height)
    case 7: {
      const flipped = flipHorizontal(src, width, height)
      return rotate90CW(flipped.buffer, flipped.width, flipped.height)
    }
    case 8:
      return rotate90CCW(src, width, height)
    default:
      return { buffer: src, width, height }
  }
}

export function swapsAxes(orientation: number): boolean {
  return orientation >= 5 && orientation <= 8
}
