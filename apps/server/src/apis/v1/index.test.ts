import type { MediaBinaryLocation, MediaBinaryProvider } from '@tg-search/core'

import { describe, expect, it, vi } from 'vitest'

// Mocks
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

vi.mock('../../db', () => {
  return {
    getDb: () => ({}),
  }
})

const mockFileTypeFromBuffer = vi.fn()

vi.mock('file-type', () => {
  return {
    fileTypeFromBuffer: (...args: any[]) => mockFileTypeFromBuffer(...args),
  }
})

// Import under test after mocks
// eslint-disable-next-line import/first
import { v1api } from './index'

describe('v1api media endpoints', () => {
  // eslint-disable-next-line test/prefer-lowercase-title
  it('GET /photos/:queryId should prefer MediaBinaryProvider when image_path is present', async () => {
    const app = v1api()

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
      expect: () => ({
        id: 'photo-id',
        image_path: 'photo/file-1',
        image_bytes: null,
        image_mime_type: 'image/jpeg',
      }),
    })

    const res = await app.fetch(new Request('http://localhost/photos/photo-id'))

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/jpeg')
    expect(res.headers.get('Content-Length')).toBe(String(bytes.length))
    expect(await res.arrayBuffer()).toEqual(bytes.buffer)

    // When mime type is stored in DB, we should not need to probe via file-type.
    expect(mockFileTypeFromBuffer).not.toHaveBeenCalled()
  })

  // eslint-disable-next-line test/prefer-lowercase-title
  it('GET /photos/:queryId should fallback to image_bytes when provider is unavailable or load returns null', async () => {
    const app = v1api()

    const bytes = new Uint8Array([9, 9, 9, 9])

    mockGetMediaBinaryProvider.mockReturnValue({
      async save() {
        throw new Error('not used in this test')
      },
      async load() {
        return null
      },
    } as MediaBinaryProvider)

    mockFindPhotoByQueryId.mockResolvedValue({
      expect: () => ({
        id: 'photo-id',
        image_path: 'photo/file-1',
        image_bytes: bytes,
        image_mime_type: undefined,
      }),
    })

    mockFileTypeFromBuffer.mockResolvedValueOnce({ mime: 'image/png' })

    const res = await app.fetch(new Request('http://localhost/photos/photo-id'))

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/png')
    expect(await res.arrayBuffer()).toEqual(bytes.buffer)
  })

  // eslint-disable-next-line test/prefer-lowercase-title
  it('GET /stickers/:queryId should mirror provider and fallback behavior for stickers', async () => {
    const app = v1api()

    const bytes = new Uint8Array([5, 6, 7])
    const provider: MediaBinaryProvider = {
      async save() {
        throw new Error('not used in this test')
      },
      async load(location: MediaBinaryLocation) {
        expect(location).toEqual({
          kind: 'sticker',
          path: 'sticker/file-2',
        })
        return bytes
      },
    }

    mockGetMediaBinaryProvider.mockReturnValue(provider)
    mockFindStickerByQueryId.mockResolvedValue({
      expect: () => ({
        id: 'sticker-id',
        sticker_path: 'sticker/file-2',
        sticker_bytes: null,
        sticker_mime_type: 'image/webp',
      }),
    })

    const res = await app.fetch(new Request('http://localhost/stickers/sticker-id'))

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/webp')
    expect(await res.arrayBuffer()).toEqual(bytes.buffer)
  })
})
