/**
 * Convert raw bytes and mime type to a Blob.
 * Designed for browser environments where avatar images arrive as Uint8Array.
 * Use precise ArrayBuffer slicing to avoid entire block copying and reduce memory usage.
 */
export function bytesToBlob(byte: Uint8Array, mimeType: string): Blob {
  // Create a new ArrayBuffer containing a copy of the bytes in the Uint8Array view.
  // This method is more robust than assuming the buffer size of the Uint8Array is exactly correct.
  const preciseBuffer = byte.buffer.slice(byte.byteOffset, byte.byteOffset + byte.byteLength)
  // Ensure the returned Buffer is ArrayBuffer rather than SharedArrayBuffer, as Blob constructor requires ArrayBuffer
  if (preciseBuffer instanceof ArrayBuffer) {
    return new Blob([preciseBuffer], { type: mimeType })
  }
  else {
    // If it is a SharedArrayBuffer, create a new copy of the ArrayBuffer.
    const buffer = new ArrayBuffer(byte.byteLength)
    const view = new Uint8Array(buffer)
    view.set(byte)
    return new Blob([buffer], { type: mimeType })
  }
}

export interface OptimizeOptions {
  maxSize?: number
  quality?: number
}

/**
 * Check whether the given avatar bytes are decodable as an image.
 * Returns true if `createImageBitmap` succeeds, false otherwise.
 */
export async function canDecodeAvatar(byte: Uint8Array | undefined, mimeType: string | undefined): Promise<boolean> {
  if (!byte || !mimeType)
    return false
  const blob = bytesToBlob(byte, mimeType)
  try {
    const imageBitmap = await createImageBitmap(blob)
    return !!imageBitmap
  }
  catch {
    return false
  }
}
