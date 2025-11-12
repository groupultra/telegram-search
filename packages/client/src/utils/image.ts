/**
 * Convert raw bytes and mime type to a Blob.
 * Designed for browser environments where avatar images arrive as Uint8Array.
 */
export function bytesToBlob(byte: Uint8Array, mimeType: string): Blob {
  // Ensure BlobPart is an ArrayBuffer (not ArrayBufferLike) to satisfy TS types.
  // Copy into a fresh ArrayBuffer to avoid offset/length issues.
  const buf = new ArrayBuffer(byte.byteLength)
  const view = new Uint8Array(buf)
  view.set(byte)
  return new Blob([buf], { type: mimeType })
}

export interface OptimizeOptions {
  maxSize?: number
  quality?: number
}

/**
 * Check if a canvas contains any transparent pixels by sampling alpha values.
 * Uses stride sampling to reduce overhead on large images.
 */
function canvasHasAlpha(canvas: HTMLCanvasElement, sampleStride = 16): boolean {
  const ctx = canvas.getContext('2d')
  if (!ctx)
    return false
  try {
    const { width, height } = canvas
    const imageData = ctx.getImageData(0, 0, width, height)
    const data = imageData.data
    // RGBA sequence; inspect alpha channel (every 4th byte)
    for (let i = 3; i < data.length; i += sampleStride) {
      if (data[i] < 255)
        return true
    }
  }
  catch {
    // If getImageData fails due to tainted canvas, assume no alpha
  }
  return false
}

/**
 * Determine an output mime type that preserves transparency when present.
 * Prefers WebP for alpha if supported; otherwise falls back to PNG.
 */
function pickOutputType(inputMime: string, canvas: HTMLCanvasElement, hasAlpha: boolean): string {
  // Animated GIF should not be recompressed via canvas (only first frame would remain)
  if (/gif/i.test(inputMime))
    return inputMime

  if (hasAlpha) {
    // Try WebP first
    try {
      const test = canvas.toDataURL('image/webp')
      if (test.startsWith('data:image/webp'))
        return 'image/webp'
    }
    catch {}
    return 'image/png'
  }

  // For non-alpha images, JPEG is space-efficient
  return 'image/jpeg'
}

/**
 * Downscale and recompress an avatar image to reduce memory footprint.
 * Uses Canvas to resize to a square within `maxSize` while preserving aspect ratio.
 * Returns a Blob of the optimized image, or the original Blob if resizing is unnecessary.
 */
export async function optimizeAvatarBlob(byte: Uint8Array, mimeType: string, options: OptimizeOptions = {}): Promise<Blob> {
  const { maxSize = 64, quality = 0.82 } = options
  const originalBlob = bytesToBlob(byte, mimeType)

  // Try createImageBitmap for fast decode; fallback to Image element
  let imageBitmap: ImageBitmap | undefined
  try {
    imageBitmap = await createImageBitmap(originalBlob)
  }
  catch {
    // Fallback: decode using HTMLImageElement
    const url = URL.createObjectURL(originalBlob)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = reject
        image.src = url
      })
      // Draw onto canvas
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
      canvas.width = Math.max(1, Math.floor(img.width * scale))
      canvas.height = Math.max(1, Math.floor(img.height * scale))
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const hasAlpha = canvasHasAlpha(canvas)
      const outType = pickOutputType(mimeType, canvas, hasAlpha)
      URL.revokeObjectURL(url)
      const out = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), outType, quality))
      return out || originalBlob
    }
    finally {
      URL.revokeObjectURL(url)
    }
  }

  if (!imageBitmap)
    return originalBlob

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const scale = Math.min(maxSize / imageBitmap.width, maxSize / imageBitmap.height, 1)
  canvas.width = Math.max(1, Math.floor(imageBitmap.width * scale))
  canvas.height = Math.max(1, Math.floor(imageBitmap.height * scale))
  ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height)

  const hasAlpha = canvasHasAlpha(canvas)
  const outType = pickOutputType(mimeType, canvas, hasAlpha)
  const out = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), outType, quality))
  return out || originalBlob
}
