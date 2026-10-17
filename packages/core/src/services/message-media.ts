import type { MessageMediaChunk, ReadMessageMediaInput } from '@tg-search/protocol'

// eslint-disable-next-line unicorn/prefer-node-protocol
import { Buffer } from 'buffer'

import { MEDIA_CHUNK_BYTES } from '@tg-search/protocol'

import { ApplicationError } from '../application/errors'

export interface MessageMediaDescriptor {
  fileId: string
  type: string
  fileName?: string
  mimeType?: string
  size: number
}

export interface MessageMediaContent extends MessageMediaDescriptor {
  bytes: Uint8Array
}

export interface ResolvedMessageMedia extends MessageMediaDescriptor {
  read: (offset: number, length: number, signal?: AbortSignal) => Promise<Uint8Array>
}

export class MessageMediaError extends ApplicationError {
  constructor(code: string, message: string) {
    super({ code, message, retryable: false })
  }
}

function descriptorOf(media: ResolvedMessageMedia): MessageMediaDescriptor {
  return { fileId: media.fileId, type: media.type, size: media.size, mimeType: media.mimeType, fileName: media.fileName }
}

/** Resolve once per operation, then share size and range validation across all output forms. */
export function createMessageMediaService(resolve: (input: ReadMessageMediaInput, signal?: AbortSignal) => Promise<ResolvedMessageMedia | undefined>) {
  async function resolveWithinBudget(input: ReadMessageMediaInput, signal?: AbortSignal): Promise<ResolvedMessageMedia> {
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
    return media
  }

  async function readRange(media: ResolvedMessageMedia, offset: number, length: number, signal?: AbortSignal): Promise<Uint8Array> {
    signal?.throwIfAborted()
    const bytes = length === 0 ? new Uint8Array() : await media.read(offset, length, signal)
    signal?.throwIfAborted()
    if (bytes.byteLength !== length)
      throw new MessageMediaError('MEDIA_INCOMPLETE', 'Source returned an incomplete media chunk')
    return bytes
  }

  async function inspect(input: ReadMessageMediaInput, signal?: AbortSignal): Promise<MessageMediaDescriptor> {
    return descriptorOf(await resolveWithinBudget(input, signal))
  }

  async function download(input: ReadMessageMediaInput, signal?: AbortSignal): Promise<MessageMediaContent> {
    const media = await resolveWithinBudget(input, signal)
    const bytes = new Uint8Array(media.size)
    for (let offset = 0; offset < media.size; offset += MEDIA_CHUNK_BYTES) {
      const length = Math.min(MEDIA_CHUNK_BYTES, media.size - offset)
      bytes.set(await readRange(media, offset, length, signal), offset)
    }
    return { ...descriptorOf(media), bytes }
  }

  async function read(input: ReadMessageMediaInput, signal?: AbortSignal): Promise<MessageMediaChunk> {
    const media = await resolveWithinBudget(input, signal)
    if (input.offset > media.size)
      throw new MessageMediaError('INVALID_ARGUMENT', 'Media offset is beyond the attachment size')

    const length = Math.min(input.length, media.size - input.offset)
    const bytes = await readRange(media, input.offset, length, signal)
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
  return { inspect, download, read }
}

/** The IPC/CLI contract keeps its bounded base64 representation. */
export function createMessageMediaReader(resolve: (input: ReadMessageMediaInput, signal?: AbortSignal) => Promise<ResolvedMessageMedia | undefined>) {
  return createMessageMediaService(resolve).read
}
