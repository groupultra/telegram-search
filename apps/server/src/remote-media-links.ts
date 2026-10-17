import type { MessageMediaDescriptor, ReadOperationOptions, TelegramApplication } from '@tg-search/core'
import type { AppError, AppResult, CreateMediaLinkInput, MediaDownloadLink, ReadMessageMediaInput } from '@tg-search/protocol'
import type { H3Event } from 'h3'
import type { InferOutput } from 'valibot'

import { Buffer } from 'node:buffer'
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto'

import { accountIdSchema, createMediaLinkInputSchema, MEDIA_CHUNK_BYTES } from '@tg-search/protocol'
import { fileTypeFromBuffer } from 'file-type'
import { integer, literal, maxLength, maxValue, minLength, minValue, number, parse, picklist, pipe, strictObject, string } from 'valibot'

const LINK_TTL_MS = 300_000
const MAX_DOWNLOAD_MS = 60_000
const MAX_MEDIA_BYTES = 50 * 1024 * 1024
const MAX_TICKET_LENGTH = 4096
const TICKET_VERSION = 1
const NONCE_BYTES = 12
const TAG_BYTES = 16
const TICKET_PURPOSE = 'telegram-search:remote-media-download:v1'
const INLINE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const PUBLIC_SOURCE_ERRORS = new Map<string, { status: number, message: string }>([
  ['REQUEST_DEADLINE_EXCEEDED', { status: 504, message: 'Media download deadline exceeded' }],
  ['REQUEST_CANCELLED', { status: 499, message: 'Media download cancelled' }],
  ['MEDIA_TOO_LARGE', { status: 413, message: 'Attachment exceeds the requested byte limit' }],
  ['INVALID_ARGUMENT', { status: 400, message: 'Invalid attachment request' }],
  ['MEDIA_NOT_AVAILABLE', { status: 404, message: 'Attachment is not available from the selected source' }],
  ['MEDIA_NOT_STORED', { status: 404, message: 'This attachment is not stored locally; select Telegram explicitly to download it' }],
  ['MEDIA_UNSUPPORTED', { status: 415, message: 'This attachment type cannot be downloaded' }],
  ['MEDIA_SIZE_UNKNOWN', { status: 502, message: 'Attachment size cannot be verified before reading' }],
  ['MEDIA_INCOMPLETE', { status: 502, message: 'Source returned incomplete attachment bytes' }],
  ['TELEGRAM_NOT_CONNECTED', { status: 503, message: 'Sign in to Telegram on the server to download this attachment' }],
])

const ticketClaimsSchema = strictObject({
  version: literal(TICKET_VERSION),
  accountId: accountIdSchema,
  source: picklist(['local', 'telegram']),
  chatId: pipe(string(), minLength(1), maxLength(128)),
  messageId: createMediaLinkInputSchema.entries.messageId,
  mediaIndex: pipe(number(), integer(), minValue(0), maxValue(Number.MAX_SAFE_INTEGER)),
  maxBytes: pipe(number(), integer(), minValue(1), maxValue(MAX_MEDIA_BYTES)),
  fileId: pipe(string(), minLength(1), maxLength(512)),
  size: pipe(number(), integer(), minValue(0), maxValue(MAX_MEDIA_BYTES)),
  expiresAt: pipe(number(), integer(), minValue(0), maxValue(Number.MAX_SAFE_INTEGER)),
})

type TicketClaims = InferOutput<typeof ticketClaimsSchema>

export interface RemoteMediaOptions {
  now?: () => number
  /** Test injection only. The deployed default is two buffered transfers. */
  maxConcurrentDownloads?: number
  /** Test injection only; all transfers remain capped at sixty seconds. */
  downloadTimeoutMs?: number
}

interface RemoteMediaCredential {
  token: string
  accountId: string
}

class MediaDownloadError extends Error {
  constructor(public code: string, message: string, public status: number, public retryable = false) {
    super(message)
  }
}

function failure(error: AppError, status: number): Response {
  return Response.json({ ok: false, error }, {
    status,
    headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', ...(error.code === 'MEDIA_DOWNLOAD_BUSY' ? { 'Retry-After': '1' } : {}) },
  })
}

function publicSourceFailure(error: AppError): { error: AppError, status: number } {
  const publicError = PUBLIC_SOURCE_ERRORS.get(error.code)
  // Capabilities can be forwarded without the bearer. Source errors must not reveal paths, queries, or SDK details.
  return publicError
    ? { error: { code: error.code, message: publicError.message, retryable: false }, status: publicError.status }
    : { error: { code: 'MEDIA_DOWNLOAD_FAILED', message: 'Unable to download attachment', retryable: false }, status: 502 }
}

function applicationFailure(error: AppError): Response {
  const publicFailure = publicSourceFailure(error)
  return failure(publicFailure.error, publicFailure.status)
}

function byteBudgetError(media: MessageMediaDescriptor, maxBytes: number): AppError | undefined {
  const totalBytes = media.size
  if (!Number.isSafeInteger(totalBytes) || totalBytes < 0)
    return { code: 'MEDIA_SIZE_UNKNOWN', message: 'Attachment size cannot be verified before reading', retryable: false }
  if (media.size > maxBytes)
    return { code: 'MEDIA_TOO_LARGE', message: 'Attachment exceeds the requested byte limit', retryable: false }
}

function readInput(input: CreateMediaLinkInput): ReadMessageMediaInput {
  return {
    operation: input.operation,
    source: input.source,
    chatId: input.chatId,
    messageId: input.messageId,
    mediaIndex: input.mediaIndex,
    maxBytes: input.maxBytes,
    offset: 0,
    length: MEDIA_CHUNK_BYTES,
  }
}

function assertSameAttachment(media: MessageMediaDescriptor, claims: TicketClaims) {
  if (media.fileId !== claims.fileId || media.size !== claims.size)
    throw new MediaDownloadError('MEDIA_CHANGED', 'Attachment changed after this link was issued; request a new link', 409)
}

function mediaHeaders(media: MessageMediaDescriptor): HeadersInit {
  // Only passive raster image formats may render on the application's origin.
  const mimeType = media.mimeType && /^[\w.+-]+\/[\w.+-]+$/.test(media.mimeType) ? media.mimeType : 'application/octet-stream'
  const disposition = INLINE_MIME_TYPES.has(mimeType) ? 'inline' : 'attachment'
  const fileName = media.fileName ?? 'attachment'
  const encodedName = encodeURIComponent(fileName.toWellFormed()).replace(/['()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
  return {
    'Cache-Control': 'private, no-store',
    'Content-Type': mimeType,
    'Content-Length': String(media.size),
    'Content-Disposition': `${disposition}; filename*=UTF-8''${encodedName}`,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  }
}

/** Holds a buffer permit and cancellation deadline through both download and response consumption. */
function createTransfer(requestSignal: AbortSignal, timeoutMs: number, release: () => void) {
  const controller = new AbortController()
  const deadlineAt = Date.now() + timeoutMs
  let finished = false
  const onRequestAbort = () => controller.abort(new MediaDownloadError('REQUEST_CANCELLED', 'Media download cancelled', 499))
  requestSignal.addEventListener('abort', onRequestAbort, { once: true })
  if (requestSignal.aborted)
    onRequestAbort()
  const timer = setTimeout(() => controller.abort(new MediaDownloadError('REQUEST_DEADLINE_EXCEEDED', 'Media download deadline exceeded', 504)), timeoutMs)

  function finish() {
    if (finished)
      return
    finished = true
    clearTimeout(timer)
    requestSignal.removeEventListener('abort', onRequestAbort)
    release()
  }

  async function wait<T>(pending: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const onAbort = () => {
        controller.signal.removeEventListener('abort', onAbort)
        reject(controller.signal.reason)
      }
      controller.signal.addEventListener('abort', onAbort, { once: true })
      pending.then((value) => {
        controller.signal.removeEventListener('abort', onAbort)
        if (controller.signal.aborted)
          reject(controller.signal.reason)
        else
          resolve(value)
      }, (error) => {
        controller.signal.removeEventListener('abort', onAbort)
        reject(error)
      })
      // Observe the source promise even when cancellation preceded this wait.
      if (controller.signal.aborted)
        onAbort()
    })
  }

  return { signal: controller.signal, deadlineAt, finish, wait }
}

function bufferedBody(content: Uint8Array, transfer: ReturnType<typeof createTransfer>): ReadableStream<Uint8Array> {
  let bytes: Uint8Array | undefined = content
  let offset = 0
  let terminal = false
  let streamController: ReadableStreamDefaultController<Uint8Array>
  const finish = () => {
    terminal = true
    bytes = undefined
    transfer.signal.removeEventListener('abort', onAbort)
    transfer.finish()
  }
  function onAbort() {
    if (terminal)
      return
    streamController.error(transfer.signal.reason)
    finish()
  }

  return new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller
      transfer.signal.addEventListener('abort', onAbort, { once: true })
      if (transfer.signal.aborted)
        onAbort()
    },
    pull(controller) {
      if (terminal)
        return
      if (!bytes)
        throw new Error('Buffered media body lost its content before completion')
      if (offset === bytes.byteLength) {
        controller.close()
        finish()
        return
      }
      const end = Math.min(offset + MEDIA_CHUNK_BYTES, bytes.byteLength)
      // Copy one output chunk so a queued final slice cannot retain the full buffer after releasing its permit.
      controller.enqueue(bytes.slice(offset, end))
      offset = end
    },
    cancel() {
      finish()
    },
  })
}

export function createRemoteMediaLinks(access: RemoteMediaCredential, getApplication: (accountId: string) => TelegramApplication, options: RemoteMediaOptions = {}) {
  const now = options.now ?? Date.now
  const limit = options.maxConcurrentDownloads ?? 2
  const timeoutMs = Math.min(options.downloadTimeoutMs ?? MAX_DOWNLOAD_MS, MAX_DOWNLOAD_MS)
  if (!Number.isInteger(limit) || limit < 1 || limit > 2 || !Number.isFinite(timeoutMs) || timeoutMs <= 0)
    throw new Error('Invalid media transfer test options')
  // Separate this capability's encryption key from the long-lived bearer and every other API purpose.
  const key = createHmac('sha256', access.token).update(TICKET_PURPOSE).digest()
  const aad = Buffer.from(TICKET_PURPOSE)
  let activeDownloads = 0

  function encode(claims: TicketClaims): string {
    const nonce = randomBytes(NONCE_BYTES)
    const cipher = createCipheriv('aes-256-gcm', key, nonce)
    cipher.setAAD(aad)
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(claims), 'utf8'), cipher.final()])
    return Buffer.concat([Buffer.from([TICKET_VERSION]), nonce, cipher.getAuthTag(), encrypted]).toString('base64url')
  }

  function decode(value: string | null): TicketClaims {
    try {
      if (!value || value.length > MAX_TICKET_LENGTH || !/^[\w-]+$/.test(value))
        throw new Error('Invalid ticket encoding')
      const packed = Buffer.from(value, 'base64url')
      if (packed.toString('base64url') !== value || packed.length <= 1 + NONCE_BYTES + TAG_BYTES || packed[0] !== TICKET_VERSION)
        throw new Error('Invalid ticket envelope')
      const decipher = createDecipheriv('aes-256-gcm', key, packed.subarray(1, 1 + NONCE_BYTES))
      decipher.setAAD(aad)
      decipher.setAuthTag(packed.subarray(1 + NONCE_BYTES, 1 + NONCE_BYTES + TAG_BYTES))
      const plaintext = Buffer.concat([decipher.update(packed.subarray(1 + NONCE_BYTES + TAG_BYTES)), decipher.final()])
      const claims = parse(ticketClaimsSchema, JSON.parse(plaintext.toString('utf8')))
      if (claims.accountId !== access.accountId || claims.size > claims.maxBytes)
        throw new Error('Invalid ticket scope')
      return claims
    }
    catch {
      // A malformed capability is one authentication failure; never reflect its contents or crypto errors.
      throw new MediaDownloadError('MEDIA_LINK_INVALID', 'Media download link is invalid', 403)
    }
  }

  function accepts(value: string | null): boolean {
    try {
      decode(value)
      return true
    }
    catch {
      return false
    }
  }

  async function createLink(input: CreateMediaLinkInput, operation: ReadOperationOptions, application: TelegramApplication): Promise<AppResult<MediaDownloadLink>> {
    const descriptor = await application.inspectMessageMedia(readInput(input), {
      ...operation,
      deadlineAt: Math.min(operation.deadlineAt ?? Date.now() + MAX_DOWNLOAD_MS, Date.now() + MAX_DOWNLOAD_MS),
    })
    if (!descriptor.ok)
      return { ok: false, error: publicSourceFailure(descriptor.error).error }
    const budgetError = byteBudgetError(descriptor.data, input.maxBytes)
    if (budgetError)
      return { ok: false, error: budgetError }
    const expiresAt = now() + LINK_TTL_MS
    const claims = parse(ticketClaimsSchema, {
      version: TICKET_VERSION,
      accountId: access.accountId,
      source: input.source,
      chatId: input.chatId,
      messageId: input.messageId,
      mediaIndex: input.mediaIndex,
      maxBytes: input.maxBytes,
      fileId: descriptor.data.fileId,
      size: descriptor.data.size,
      expiresAt,
    })
    const { type, size, mimeType, fileName } = descriptor.data
    return { ok: true, data: { path: `/v1/remote/media.download?ticket=${encode(claims)}`, expiresAt, media: { type, size, mimeType, fileName } } }
  }

  async function download(event: H3Event): Promise<Response> {
    let transfer: ReturnType<typeof createTransfer> | undefined
    let bodyOwnsTransfer = false
    try {
      const query = event.url.searchParams
      if ([...query.keys()].some(key => key !== 'ticket') || query.getAll('ticket').length !== 1)
        throw new MediaDownloadError('MEDIA_LINK_INVALID', 'Media download link is invalid', 403)
      const claims = decode(query.get('ticket'))
      if (now() >= claims.expiresAt)
        throw new MediaDownloadError('MEDIA_LINK_EXPIRED', 'Media download link expired; request a new link', 410)
      const head = event.req.method === 'HEAD'
      if (activeDownloads >= limit)
        throw new MediaDownloadError('MEDIA_DOWNLOAD_BUSY', 'Media download capacity is busy; retry shortly', 503, true)
      activeDownloads++
      transfer = createTransfer(event.req.signal, timeoutMs, () => {
        activeDownloads--
      })
      transfer.signal.throwIfAborted()
      const operation = { signal: transfer.signal, deadlineAt: transfer.deadlineAt }
      const input = readInput(claims)
      const application = getApplication(access.accountId)
      const inspected = await transfer.wait(application.inspectMessageMedia(input, operation))
      if (!inspected.ok)
        return applicationFailure(inspected.error)
      assertSameAttachment(inspected.data, claims)
      const budgetError = byteBudgetError(inspected.data, claims.maxBytes)
      if (budgetError)
        return applicationFailure(budgetError)
      if (head)
        return new Response(null, { headers: mediaHeaders(inspected.data) })
      const downloaded = await transfer.wait(application.downloadMessageMedia(input, operation))
      if (!downloaded.ok)
        return applicationFailure(downloaded.error)
      assertSameAttachment(downloaded.data, claims)
      if (downloaded.data.bytes.byteLength !== claims.size)
        throw new MediaDownloadError('MEDIA_INCOMPLETE', 'Source returned incomplete attachment bytes', 502)
      const content = {
        ...downloaded.data,
        mimeType: downloaded.data.mimeType ?? (await transfer.wait(fileTypeFromBuffer(downloaded.data.bytes)))?.mime,
      }
      transfer.signal.throwIfAborted()
      const response = new Response(bufferedBody(content.bytes, transfer), { headers: mediaHeaders(content) })
      bodyOwnsTransfer = true
      return response
    }
    catch (error) {
      const failureError = transfer?.signal.aborted ? transfer.signal.reason : error
      if (failureError instanceof MediaDownloadError)
        return failure({ code: failureError.code, message: failureError.message, retryable: failureError.retryable }, failureError.status)
      return failure({ code: 'MEDIA_DOWNLOAD_FAILED', message: 'Unable to download attachment', retryable: false }, 502)
    }
    finally {
      if (!bodyOwnsTransfer)
        transfer?.finish()
    }
  }

  return { accepts, createLink, download }
}
