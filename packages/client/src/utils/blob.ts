import type { CoreMessageMediaFromBlob } from '@tg-search/core'

// eslint-disable-next-line unicorn/prefer-node-protocol
import { Buffer } from 'buffer'

import pako from 'pako'

export function createMediaBlob(media: CoreMessageMediaFromBlob) {
  const mediaCopy = { ...media }

  if (mediaCopy.byte?.length) {
    let buffer: Uint8Array

    // 统一处理：Buffer、Uint8Array 或序列化格式
    if (mediaCopy.byte instanceof Buffer || mediaCopy.byte instanceof Uint8Array) {
      buffer = new Uint8Array(mediaCopy.byte)
    }
    else if ((mediaCopy.byte as any).data) {
      buffer = new Uint8Array((mediaCopy.byte as any).data)
    }
    else {
      return mediaCopy
    }

    if (mediaCopy.type === 'sticker' && mediaCopy.mimeType === 'application/gzip') {
      try {
        mediaCopy.tgsAnimationData = pako.inflate(buffer, { to: 'string' })
      }
      catch {
        console.error('Failed to inflate TGS data')
      }
    }
    else {
      try {
        // 创建一个新的 ArrayBuffer 来存储数据
        const arrayBuffer = new ArrayBuffer(buffer.length)
        const view = new Uint8Array(arrayBuffer)
        view.set(buffer)
        const blob = new Blob([arrayBuffer], { type: mediaCopy.mimeType })
        mediaCopy.blobUrl = URL.createObjectURL(blob)
      }
      catch {
        console.error('Failed to create blob URL')
      }
    }
  }

  mediaCopy.byte = undefined
  return mediaCopy
}

export function cleanupMediaBlob(media: CoreMessageMediaFromBlob): void {
  if (media.blobUrl) {
    URL.revokeObjectURL(media.blobUrl)

    // eslint-disable-next-line no-console
    console.log('[Blob] Blob URL revoked:', { url: media.blobUrl })

    media.blobUrl = undefined
  }
}

export function cleanupMediaBlobs(mediaArray: CoreMessageMediaFromBlob[]): void {
  mediaArray.forEach(cleanupMediaBlob)
}
