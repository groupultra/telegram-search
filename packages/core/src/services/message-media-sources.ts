import type { ReadMessageMediaInput } from '@tg-search/protocol'
import type { TelegramClient } from 'telegram'

import type { ReadOperationScope } from '../application/read-operation'
import type { CoreDB } from '../db'
import type { Models } from '../models'
import type { MediaBinaryProvider } from '../types/storage'
import type { ResolvedMessageMedia } from './message-media'

import bigInt from 'big-integer'

import { Api, utils } from 'telegram'

import { MessageMediaError } from './message-media'

/** Fetches one message before downloading, so callers cannot supply arbitrary Telegram file references. */
export function createTelegramMessageMediaSource(
  client: TelegramClient,
  getInputPeer: (chatId: string) => Promise<Api.TypeInputPeer>,
  scope?: ReadOperationScope,
) {
  return async (input: ReadMessageMediaInput, signal?: AbortSignal): Promise<ResolvedMessageMedia | undefined> => {
    signal?.throwIfAborted()
    if (input.mediaIndex !== 0)
      return undefined
    const peer = await (scope ? scope.telegram(client, () => getInputPeer(input.chatId)) : getInputPeer(input.chatId))
    signal?.throwIfAborted()
    const fetch = () => client.getMessages(peer, { ids: [Number(input.messageId)] })
    const [message] = await (scope ? scope.telegram(client, fetch) : fetch())
    signal?.throwIfAborted()
    if (!(message instanceof Api.Message))
      return undefined
    const actualChatId = message.peerId instanceof Api.PeerChannel
      ? message.peerId.channelId.toString()
      : message.peerId instanceof Api.PeerChat
        ? message.peerId.chatId.toString()
        : message.peerId.userId.toString()
    if (actualChatId !== input.chatId || message.id.toString() !== input.messageId)
      return undefined

    const media = message.media
    if (!(media instanceof Api.MessageMediaDocument) && !(media instanceof Api.MessageMediaPhoto))
      throw new MessageMediaError('MEDIA_UNSUPPORTED', 'Only photo and document attachments can be downloaded')
    if (media instanceof Api.MessageMediaPhoto) {
      if (!(media.photo instanceof Api.Photo))
        return undefined
      const selected = media.photo.sizes.at(-1)
      const photoBytes = selected ? utils._photoSizeByteCount(selected) : undefined
      if (photoBytes === undefined || photoBytes <= 0)
        throw new MessageMediaError('MEDIA_SIZE_UNKNOWN', 'Attachment size cannot be verified before reading')
    }
    if (media instanceof Api.MessageMediaDocument && !(media.document instanceof Api.Document))
      return undefined
    const file = utils.getFileInfo(media)
    if (file.size === undefined || file.size.greater(Number.MAX_SAFE_INTEGER))
      throw new MessageMediaError('MEDIA_SIZE_UNKNOWN', 'Attachment size cannot be verified before reading')
    const document = media instanceof Api.MessageMediaDocument && media.document instanceof Api.Document ? media.document : undefined
    const fileName = document?.attributes.find(attribute => attribute instanceof Api.DocumentAttributeFilename)
    return {
      type: document ? 'document' : 'photo',
      fileName: fileName instanceof Api.DocumentAttributeFilename ? fileName.fileName : undefined,
      mimeType: document?.mimeType || undefined,
      size: file.size.toJSNumber(),
      async read(offset, length, readSignal) {
        readSignal?.throwIfAborted()
        const iterator = client.iterDownload({
          file: file.location,
          dcId: file.dcId,
          fileSize: file.size,
          offset: bigInt(offset),
          limit: 1,
          chunkSize: length,
          requestSize: Math.max(4096, Math.ceil(length / 4096) * 4096),
          msgData: [peer, message.id],
        })
        try {
          const next = () => iterator[Symbol.asyncIterator]().next()
          const result = await (scope ? scope.telegram(client, next) : next())
          readSignal?.throwIfAborted()
          return result.done ? new Uint8Array() : new Uint8Array(result.value).subarray(0, length)
        }
        finally {
          await iterator.close()
        }
      },
    }
  }
}

export function createLocalMessageMediaSource(options: {
  db: CoreDB
  models: Models
  getAccountId: () => string
  mediaBinaryProvider?: MediaBinaryProvider
}) {
  return async (input: ReadMessageMediaInput, signal?: AbortSignal): Promise<ResolvedMessageMedia | undefined> => {
    signal?.throwIfAborted()
    const rows = (await options.models.chatMessageModels.fetchMessagesByChatAndPlatformIds(
      options.db,
      options.getAccountId(),
      [{ chatId: input.chatId, messageId: input.messageId }],
    )).expect('Failed to resolve stored attachment owner')
    const message = rows[0]
    const media = message?.media[input.mediaIndex]
    if (!message || !media)
      return undefined

    let bytes: Uint8Array | undefined
    let path: string | undefined
    let mimeType: string | undefined
    if (media.type === 'photo') {
      const photos = (await options.models.photoModels.findPhotosByMessageId(options.db, message.id)).expect('Failed to resolve stored photo')
      const photo = photos.find(photo => photo.file_id === media.platformId)
      if (!photo)
        return undefined
      bytes = photo.image_bytes == null ? undefined : new Uint8Array(photo.image_bytes)
      path = photo.image_path || undefined
      mimeType = photo.image_mime_type || undefined
    }
    else if (media.type === 'sticker') {
      const sticker = (await options.models.stickerModels.findStickerByFileId(options.db, media.platformId)).expect('Failed to resolve stored sticker')
      bytes = sticker.sticker_bytes == null ? undefined : new Uint8Array(sticker.sticker_bytes)
      path = sticker.sticker_path || undefined
      mimeType = sticker.sticker_mime_type || undefined
    }
    else {
      throw new MessageMediaError('MEDIA_NOT_STORED', 'This attachment type is not stored locally; select Telegram explicitly to download it')
    }
    signal?.throwIfAborted()
    if (bytes) {
      const stored = bytes
      return { type: media.type, mimeType, size: stored.byteLength, read: async (offset, length) => stored.subarray(offset, offset + length) }
    }
    const provider = options.mediaBinaryProvider
    if (!path || !provider)
      return undefined
    const location = { kind: media.type, path }
    const size = await provider.size(location)
    if (size === null)
      return undefined
    return {
      type: media.type,
      mimeType,
      size,
      read: async (offset, length, readSignal) => {
        const chunk = await provider.loadRange(location, offset, length, readSignal)
        if (chunk === null)
          throw new MessageMediaError('MEDIA_NOT_AVAILABLE', 'Stored attachment is no longer available')
        return chunk
      },
    }
  }
}
