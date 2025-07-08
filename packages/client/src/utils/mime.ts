export function getMediaMimeType(mediaType: string): string {
  switch (mediaType) {
    case 'photo':
      return 'image/jpeg'
    case 'sticker':
      // Telegram stickers are usually WebM or WebP
      return 'video/webm'
    case 'document':
      return 'application/octet-stream'
    default:
      return 'application/octet-stream'
  }
}
