import type { Logger } from '@guiiai/logg'
import type { MediaBinaryDescriptor, MediaBinaryLocation, MediaBinaryProvider } from '@tg-search/core'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSetMediaBinaryProvider = vi.fn<(provider: MediaBinaryProvider) => void>()

vi.mock('@tg-search/core', () => {
  return {
    setMediaBinaryProvider: (...args: any[]) => mockSetMediaBinaryProvider(...args),
  }
})

const bucketExists = vi.fn()
const makeBucket = vi.fn()
const putObject = vi.fn()
const getObject = vi.fn()

vi.mock('minio', () => {
  class MockMinioClient {
    bucketExists = bucketExists
    makeBucket = makeBucket
    putObject = putObject
    getObject = getObject

    constructor(public readonly options: any) {}
  }

  return {
    Client: MockMinioClient,
  }
})

// Import under test after mocks
// eslint-disable-next-line import/first
import { registerMinioMediaStorage } from './minio'

describe('storage/minio - registerMinioMediaStorage', () => {
  const logger: Logger = {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    withFields() {
      return this
    },
    withError() {
      return this
    },
  } as any

  beforeEach(() => {
    vi.resetAllMocks()

    process.env.MINIO_ENDPOINT = 'localhost'
    process.env.MINIO_PORT = '9000'
    process.env.MINIO_ACCESS_KEY = 'access'
    process.env.MINIO_SECRET_KEY = 'secret'
    process.env.MINIO_USE_SSL = 'false'
    process.env.MINIO_BUCKET = 'telegram-media-test'
  })

  it('registers a MediaBinaryProvider that writes and reads objects via MinIO', async () => {
    bucketExists.mockResolvedValue(true)

    const chunks: Buffer[] = []
    getObject.mockResolvedValue({
      async* [Symbol.asyncIterator]() {
        for (const chunk of chunks) {
          yield chunk
        }
      },
    })

    await registerMinioMediaStorage(logger)

    expect(bucketExists).toHaveBeenCalledWith('telegram-media-test')
    expect(mockSetMediaBinaryProvider).toHaveBeenCalledTimes(1)

    const provider = mockSetMediaBinaryProvider.mock.calls[0][0] as MediaBinaryProvider

    const descriptor: MediaBinaryDescriptor = {
      kind: 'photo',
      platform: 'telegram',
      platformId: 'file-123',
      messageUUID: 'msg-1',
    }

    const bytes = new Uint8Array([1, 2, 3])

    const location: MediaBinaryLocation = await provider.save(descriptor, bytes, 'image/jpeg')

    expect(location).toEqual({
      kind: 'photo',
      path: 'photo/telegram/file-123',
    })

    expect(putObject).toHaveBeenCalledTimes(1)
    const [bucket, objectName, buffer, _size, meta] = putObject.mock.calls[0]
    expect(bucket).toBe('telegram-media-test')
    expect(objectName).toBe('photo/telegram/file-123')
    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(meta).toEqual({
      'Content-Type': 'image/jpeg',
    })

    // Simulate persisted object for load().
    chunks.push(Buffer.from(bytes))

    const loaded = await provider.load(location)
    expect(loaded).toBeInstanceOf(Uint8Array)
    expect(Array.from(loaded ?? [])).toEqual(Array.from(bytes))
  })

  it('provider.load returns null and logs a warning when MinIO throws', async () => {
    bucketExists.mockResolvedValue(true)
    getObject.mockRejectedValue(new Error('boom'))

    await registerMinioMediaStorage(logger)

    const provider = mockSetMediaBinaryProvider.mock.calls[0][0] as MediaBinaryProvider

    const location: MediaBinaryLocation = {
      kind: 'photo',
      path: 'photo/telegram/missing',
    }

    const result = await provider.load(location)
    expect(result).toBeNull()
    expect(logger.warn).toHaveBeenCalled()
  })
})
