import type { MinioConfig } from '@tg-search/common'
import type { MediaBinaryDescriptor, MediaBinaryLocation } from '@tg-search/core'

// eslint-disable-next-line unicorn/prefer-node-protocol
import { Buffer } from 'buffer'

import { v4 as uuidv4 } from 'uuid'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getMinioMediaStorage, initMinioMediaStorage } from './minio'

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

const config: MinioConfig = {
  endpoint: 'localhost',
  port: 9000,
  accessKey: 'access',
  secretKey: 'secret',
  useSSL: false,
  bucket: 'telegram-media-test',
}

describe('storage/minio - initMinioMediaStorage', () => {
  const logger = {
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

    await initMinioMediaStorage(logger, config)

    expect(bucketExists).toHaveBeenCalledWith('telegram-media-test')

    const provider = getMinioMediaStorage()
    expect(provider).toBeDefined()

    const uuid = uuidv4()
    const descriptor: MediaBinaryDescriptor = {
      kind: 'photo',
      uuid,
    }

    const bytes = new Uint8Array([1, 2, 3])

    const location: MediaBinaryLocation = await provider!.save(descriptor, bytes, 'image/jpeg')

    expect(location).toEqual({
      kind: 'photo',
      path: `photo/${uuid}`,
    })

    expect(putObject).toHaveBeenCalledTimes(1)
    const [bucket, objectName, buffer,, meta] = putObject.mock.calls[0]
    expect(bucket).toBe('telegram-media-test')
    expect(objectName).toBe(`photo/${uuid}`)
    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(meta).toEqual({
      'Content-Type': 'image/jpeg',
    })

    // Simulate persisted object for load().
    chunks.push(Buffer.from(bytes))

    const loaded = await provider!.load(location)
    expect(loaded).toBeInstanceOf(Uint8Array)
    expect(Array.from(loaded ?? [])).toEqual(Array.from(bytes))
  })

  it('provider.load returns null and logs a warning when MinIO throws', async () => {
    bucketExists.mockResolvedValue(true)
    getObject.mockRejectedValue(new Error('boom'))

    await initMinioMediaStorage(logger, config)

    const provider = getMinioMediaStorage()
    expect(provider).toBeDefined()

    const location: MediaBinaryLocation = {
      kind: 'photo',
      path: 'photo/missing',
    }

    const result = await provider!.load(location)
    expect(result).toBeNull()
    expect(logger.warn).toHaveBeenCalled()
  })
})
