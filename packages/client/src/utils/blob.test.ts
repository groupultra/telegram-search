import type { CoreMessageMediaFromBlob } from '@tg-search/core'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { cleanupMediaBlob, cleanupMediaBlobs, createMediaBlob } from './blob'

describe('blob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  describe('createMediaBlob', () => {
    it('should build HTTP URL for photo media with queryId', () => {
      const media: CoreMessageMediaFromBlob = {
        type: 'photo',
        platformId: 'test-id',
        mimeType: 'image/jpeg',
        queryId: 'photo-query-id',
      }

      const result = createMediaBlob(media)

      expect(result.blobUrl).toBe('/api/v1/photos/photo-query-id')
    })

    it('should not set blobUrl when queryId is missing', () => {
      const media: CoreMessageMediaFromBlob = {
        type: 'photo',
        platformId: 'test-id',
        mimeType: 'image/jpeg',
      }

      const result = createMediaBlob(media)

      expect(result.blobUrl).toBeUndefined()
    })

    it('should leave non-photo media unchanged', () => {
      const media: CoreMessageMediaFromBlob = {
        type: 'document',
        platformId: 'test-id',
        mimeType: 'application/pdf',
        queryId: 'doc-query-id',
      }

      const result = createMediaBlob(media)

      expect(result.blobUrl).toBeUndefined()
    })
  })

  describe('cleanupMediaBlob', () => {
    it('should revoke blob URL if it exists and is a blob URL', () => {
      const media: CoreMessageMediaFromBlob = {
        type: 'photo',
        platformId: 'test-id',
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
        mimeType: 'image/jpeg',
      }

      cleanupMediaBlob(media)

      expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    })

    it('should handle media with undefined blobUrl', () => {
      const media: CoreMessageMediaFromBlob = {
        type: 'photo',
        platformId: 'test-id',
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
          mimeType: 'image/jpeg',
          blobUrl: 'blob:url-1',
        },
        {
          type: 'document',
          platformId: 'test-id-2',
          mimeType: 'video/mp4',
          blobUrl: 'blob:url-2',
        },
        {
          type: 'photo',
          platformId: 'test-id-3',
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
          mimeType: 'image/jpeg',
          blobUrl: 'blob:url-1',
        },
        {
          type: 'document',
          platformId: 'test-id-2',
          mimeType: 'video/mp4',
        },
        {
          type: 'photo',
          platformId: 'test-id-3',
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
