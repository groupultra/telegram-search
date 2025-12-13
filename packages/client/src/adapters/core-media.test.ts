import type { CoreMessageMediaFromBlob, MediaBinaryLocation, MediaBinaryProvider } from '@tg-search/core'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFindPhotoByQueryId = vi.fn()
const mockFindStickerByQueryId = vi.fn()
const mockGetMediaBinaryProvider = vi.fn()

vi.mock('@tg-search/core', () => {
  return {
    findPhotoByQueryId: (...args: any[]) => mockFindPhotoByQueryId(...args),
    findStickerByQueryId: (...args: any[]) => mockFindStickerByQueryId(...args),
    getMediaBinaryProvider: () => mockGetMediaBinaryProvider(),
  }
})

const mockGetDB = vi.fn()

vi.mock('./core-db', () => {
  return {
    getDB: () => mockGetDB(),
  }
})

vi.mock('@guiiai/logg', () => {
  return {
    useLogger: () => ({
      debug: vi.fn(),
      warn: vi.fn(),
      withError() {
        return this
      },
    }),
  }
})

// Import under test after mocks
// eslint-disable-next-line import/first
import { hydrateMediaBlobWithCore } from './core-media'

describe('adapters/core-media - hydrateMediaBlobWithCore', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    mockGetDB.mockReturnValue({})

    // Stub URL.createObjectURL so we can assert on the produced blob URL.
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url')
  })

  it('hydrates photo blob via MediaBinaryProvider when image_path is present', async () => {
    const bytes = new Uint8Array([1, 2, 3])

    const provider: MediaBinaryProvider = {
      async save() {
        throw new Error('not used in this test')
      },
      async load(location: MediaBinaryLocation) {
        expect(location).toEqual({
          kind: 'photo',
          path: 'photo/file-1',
        })
        return bytes
      },
    }

    mockGetMediaBinaryProvider.mockReturnValue(provider)
    mockFindPhotoByQueryId.mockResolvedValue({
      orUndefined: () => ({
        image_path: 'photo/file-1',
        image_bytes: null,
        image_mime_type: 'image/jpeg',
      }),
    })

    const media: CoreMessageMediaFromBlob = {
      type: 'photo',
      platformId: 'file-1',
      mimeType: 'image/jpeg',
      queryId: 'photo-query',
    }

    await hydrateMediaBlobWithCore(media)

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(media.blobUrl).toBe('blob:test-url')
  })

  it('falls back to image_bytes when provider is unavailable', async () => {
    const bytes = new Uint8Array([9, 9, 9, 9])

    mockGetMediaBinaryProvider.mockReturnValue(undefined)
    mockFindPhotoByQueryId.mockResolvedValue({
      orUndefined: () => ({
        image_path: null,
        image_bytes: bytes,
        image_mime_type: 'image/png',
      }),
    })

    const media: CoreMessageMediaFromBlob = {
      type: 'photo',
      platformId: 'file-2',
      mimeType: 'image/png',
      queryId: 'photo-query-2',
    }

    await hydrateMediaBlobWithCore(media)

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(media.blobUrl).toBe('blob:test-url')
  })

  it('hydrates sticker blob through provider when sticker_path is present', async () => {
    const bytes = new Uint8Array([7, 8, 9])

    const provider: MediaBinaryProvider = {
      async save() {
        throw new Error('not used in this test')
      },
      async load(location: MediaBinaryLocation) {
        expect(location).toEqual({
          kind: 'sticker',
          path: 'sticker/file-3',
        })
        return bytes
      },
    }

    mockGetMediaBinaryProvider.mockReturnValue(provider)
    mockFindStickerByQueryId.mockResolvedValue({
      orUndefined: () => ({
        sticker_path: 'sticker/file-3',
        sticker_bytes: null,
        sticker_mime_type: 'image/webp',
      }),
    })

    const media: CoreMessageMediaFromBlob = {
      type: 'sticker',
      platformId: 'file-3',
      mimeType: 'image/webp',
      queryId: 'sticker-query',
    }

    await hydrateMediaBlobWithCore(media)

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(media.blobUrl).toBe('blob:test-url')
  })
})
