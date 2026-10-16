import type { MinioConfig } from '@tg-search/common'
import type { MediaBinaryDescriptor, MediaBinaryLocation } from '@tg-search/core'

// eslint-disable-next-line unicorn/prefer-node-protocol
import { Buffer } from 'buffer'
import { PassThrough, Readable } from 'node:stream'

import { v4 as uuidv4 } from 'uuid'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getMinioMediaStorage, initMinioMediaStorage } from './minio'

const bucketExists = vi.fn()
const makeBucket = vi.fn()
const putObject = vi.fn()
const getObject = vi.fn()
const statObject = vi.fn()
const getPartialObject = vi.fn()

vi.mock('minio', () => {
  class MockMinioClient {
    bucketExists = bucketExists
    makeBucket = makeBucket
    putObject = putObject
    getObject = getObject
    statObject = statObject
    getPartialObject = getPartialObject

    constructor(public readonly options: any) {}
  }

  return {
    Client: MockMinioClient,
  }
})

const config: MinioConfig = {
  url: 'http://localhost:9000',
  accessKey: 'access',
  secretKey: 'secret',
  bucket: 'telegram-media-test',

  port: 9000,
  useSSL: false,
  endPoint: 'http://localhost:9000',
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

  it('checks object size and requests only the selected byte range', async () => {
    bucketExists.mockResolvedValue(true)
    statObject.mockResolvedValue({ size: 10 })
    getPartialObject.mockResolvedValue(Readable.from([Buffer.from('defg')]))
    await initMinioMediaStorage(logger, config)
    const provider = getMinioMediaStorage()!
    const location: MediaBinaryLocation = { kind: 'photo', path: 'photo/fixture' }
    expect(await provider.size(location)).toBe(10)
    expect(Buffer.from((await provider.loadRange(location, 3, 4))!).toString()).toBe('defg')
    expect(getPartialObject).toHaveBeenCalledWith(config.bucket, location.path, 3, 4)
    expect(getObject).not.toHaveBeenCalled()
  })

  it('distinguishes an object removed after stat from a permission failure', async () => {
    bucketExists.mockResolvedValue(true)
    await initMinioMediaStorage(logger, config)
    const provider = getMinioMediaStorage()!
    const location: MediaBinaryLocation = { kind: 'photo', path: 'photo/fixture' }
    getPartialObject.mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 'NoSuchKey' }))
    expect(await provider.loadRange(location, 0, 4)).toBeNull()
    getPartialObject.mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'AccessDenied' }))
    await expect(provider.loadRange(location, 0, 4)).rejects.toThrow('denied')
  })

  it('destroys an active partial stream when the request is cancelled', async () => {
    bucketExists.mockResolvedValue(true)
    const stream = new PassThrough()
    getPartialObject.mockResolvedValue(stream)
    await initMinioMediaStorage(logger, config)
    const controller = new AbortController()
    const reading = getMinioMediaStorage()!.loadRange({ kind: 'photo', path: 'photo/fixture' }, 0, 4, controller.signal)
    const rejected = expect(reading).rejects.toThrow('cancelled')
    await new Promise(resolve => setTimeout(resolve, 0))
    controller.abort(new Error('cancelled'))
    await rejected
    expect(stream.destroyed).toBe(true)
  })

  it('rejects and closes a stream that exceeds the requested range', async () => {
    bucketExists.mockResolvedValue(true)
    const stream = Readable.from([Buffer.from('oversized')])
    getPartialObject.mockResolvedValue(stream)
    await initMinioMediaStorage(logger, config)
    await expect(getMinioMediaStorage()!.loadRange({ kind: 'photo', path: 'photo/fixture' }, 0, 4)).rejects.toThrow('more bytes than requested')
    expect(stream.destroyed).toBe(true)
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
