import type { MessageMediaChunk, ReadMessageMediaInput } from '@tg-search/protocol'

// eslint-disable-next-line unicorn/prefer-node-protocol
import { Buffer } from 'buffer'

import { ApplicationError } from '../application/errors'

export interface ResolvedMessageMedia {
  type: string
  fileName?: string
  mimeType?: string
  size: number
  read: (offset: number, length: number, signal?: AbortSignal) => Promise<Uint8Array>
}

export class MessageMediaError extends ApplicationError {
  constructor(code: string, message: string) {
    super({ code, message, retryable: false })
  }
}

/** The resolver owns source-specific lookup; this reader owns byte limits and honest continuation. */
export function createMessageMediaReader(resolve: (input: ReadMessageMediaInput, signal?: AbortSignal) => Promise<ResolvedMessageMedia | undefined>) {
  return async (input: ReadMessageMediaInput, signal?: AbortSignal): Promise<MessageMediaChunk> => {
    signal?.throwIfAborted()
    const media = await resolve(input, signal)
    signal?.throwIfAborted()
    if (!media)
      throw new MessageMediaError('MEDIA_NOT_AVAILABLE', 'Attachment is not available from the selected source')
    const totalBytes = media.size
    if (!Number.isSafeInteger(totalBytes) || totalBytes < 0)
      throw new MessageMediaError('MEDIA_SIZE_UNKNOWN', 'Attachment size cannot be verified before reading')
    if (media.size > input.maxBytes)
      throw new MessageMediaError('MEDIA_TOO_LARGE', 'Attachment exceeds the requested byte limit')
    if (input.offset > media.size)
      throw new MessageMediaError('INVALID_ARGUMENT', 'Media offset is beyond the attachment size')

    const length = Math.min(input.length, media.size - input.offset)
    const bytes = length === 0 ? new Uint8Array() : await media.read(input.offset, length, signal)
    signal?.throwIfAborted()
    if (bytes.byteLength !== length)
      throw new MessageMediaError('MEDIA_INCOMPLETE', 'Source returned an incomplete media chunk')
    const next = input.offset + bytes.byteLength
    return {
      source: input.source,
      chatId: input.chatId,
      messageId: input.messageId,
      mediaIndex: input.mediaIndex,
      type: media.type,
      fileName: media.fileName,
      mimeType: media.mimeType,
      size: media.size,
      encoding: 'base64',
      data: Buffer.from(bytes).toString('base64'),
      offset: input.offset,
      nextOffset: next < media.size ? next : null,
      contentStatus: input.offset === 0 && next === media.size ? 'complete' : 'partial',
    }
  }
}
