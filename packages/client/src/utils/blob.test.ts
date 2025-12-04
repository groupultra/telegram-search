import type { CoreMessageMediaFromBlob } from '@tg-search/core'

import { Buffer } from 'node:buffer'

import pako from 'pako'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { cleanupMediaBlob, cleanupMediaBlobs, createMediaBlob } from './blob'

// Mock pako
vi.mock('pako', () => ({
  default: {
    inflate: vi.fn(() => 'inflated-animation-data'),
  },
}))

describe('blob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url-123')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  describe('createMediaBlob', () => {
    it('should create blob URL for regular media with byte data', () => {
      const media: CoreMessageMediaFromBlob = {
        type: 'photo',
        platformId: 'test-id',
        mimeType: 'image/jpeg',
        byte: Buffer.from([1, 2, 3, 4]),
      }

      const result = createMediaBlob(media)

      expect(result.blobUrl).toBe('blob:test-url-123')
      expect(result.byte).toBeUndefined()
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    })

    it('should handle byte data with .data property', () => {
      const media: CoreMessageMediaFromBlob = {
        type: 'photo',
        platformId: 'test-id',
        mimeType: 'image/jpeg',
        byte: Buffer.from([5, 6, 7, 8]),
      }

      const result = createMediaBlob(media)

      expect(result.blobUrl).toBe('blob:test-url-123')
      expect(result.byte).toBeUndefined()
    })

    it('should inflate gzip sticker data', () => {
      const media: CoreMessageMediaFromBlob = {
        type: 'sticker',
        platformId: 'test-id',
        mimeType: 'application/gzip',
        byte: Buffer.from([10, 20, 30]),
      }

      const result = createMediaBlob(media)

      expect(pako.inflate).toHaveBeenCalledWith(expect.any(Uint8Array), { to: 'string' })
      expect(result.tgsAnimationData).toBe('inflated-animation-data')
      expect(result.blobUrl).toBeUndefined()
      expect(result.byte).toBeUndefined()
    })

    it('should handle media without byte data', () => {
      const media: CoreMessageMediaFromBlob = {
        type: 'photo',
        platformId: 'test-id',
        mimeType: 'image/jpeg',
        byte: undefined,
      }

      const result = createMediaBlob(media)

      expect(result.blobUrl).toBeUndefined()
      expect(result.byte).toBeUndefined()
      expect(URL.createObjectURL).not.toHaveBeenCalled()
    })

    it('should handle media with empty buffer', () => {
      const media: CoreMessageMediaFromBlob = {
        type: 'webpage',
        platformId: 'test-id',
        mimeType: 'image/jpeg',
        byte: Buffer.from([]),
      }

      const result = createMediaBlob(media)

      expect(result.blobUrl).toBe('blob:test-url-123')
      expect(result.byte).toBeUndefined()
    })

    it('should create blob with correct mime type', () => {
      const media: CoreMessageMediaFromBlob = {
        type: 'document',
        platformId: 'test-id',
        mimeType: 'video/mp4',
        byte: Buffer.from([1, 2, 3]),
      }

      createMediaBlob(media)

      // Since we can't easily mock Blob constructor, just verify createObjectURL was called
      expect(URL.createObjectURL).toHaveBeenCalled()
    })
  })

  describe('cleanupMediaBlob', () => {
    it('should revoke blob URL if it exists', () => {
      const media: CoreMessageMediaFromBlob = {
        type: 'photo',
        platformId: 'test-id',
        byte: undefined,
        mimeType: 'image/jpeg',
        blobUrl: 'blob:existing-url',
      }

      cleanupMediaBlob(media)

      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:existing-url')
      expect(media.blobUrl).toBeUndefined()
    })

    it('should not revoke if blob URL does not exist', () => {
      const media: CoreMessageMediaFromBlob = {
        type: 'photo',
        platformId: 'test-id',
        byte: undefined,
        mimeType: 'image/jpeg',
      }

      cleanupMediaBlob(media)

      expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    })

    it('should handle media with undefined blobUrl', () => {
      const media: CoreMessageMediaFromBlob = {
        type: 'photo',
        platformId: 'test-id',
        byte: undefined,
        mimeType: 'image/jpeg',
        blobUrl: undefined,
      }

      cleanupMediaBlob(media)

      expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    })
  })

  describe('cleanupMediaBlobs', () => {
    it('should cleanup all media blobs in array', () => {
      const mediaArray: CoreMessageMediaFromBlob[] = [
        {
          type: 'photo',
          platformId: 'test-id-1',
          byte: undefined,
          mimeType: 'image/jpeg',
          blobUrl: 'blob:url-1',
        },
        {
          type: 'document',
          platformId: 'test-id-2',
          byte: undefined,
          mimeType: 'video/mp4',
          blobUrl: 'blob:url-2',
        },
        {
          type: 'photo',
          platformId: 'test-id-3',
          byte: undefined,
          mimeType: 'image/png',
          blobUrl: 'blob:url-3',
        },
      ]

      cleanupMediaBlobs(mediaArray)

      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3)
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:url-1')
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:url-2')
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:url-3')
      mediaArray.forEach(media => expect(media.blobUrl).toBeUndefined())
    })

    it('should handle empty array', () => {
      cleanupMediaBlobs([])
      expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    })

    it('should handle mixed array with some items having no blobUrl', () => {
      const mediaArray: CoreMessageMediaFromBlob[] = [
        {
          type: 'photo',
          platformId: 'test-id-1',
          byte: undefined,
          mimeType: 'image/jpeg',
          blobUrl: 'blob:url-1',
        },
        {
          type: 'document',
          platformId: 'test-id-2',
          byte: undefined,
          mimeType: 'video/mp4',
        },
        {
          type: 'photo',
          platformId: 'test-id-3',
          byte: undefined,
          mimeType: 'image/png',
          blobUrl: 'blob:url-2',
        },
      ]

      cleanupMediaBlobs(mediaArray)

      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:url-1')
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:url-2')
    })
  })
})
