import { describe, expect, it } from 'vitest'

import type { DBSelectPhoto } from './photos'

import { convertDBPhotoToCoreMessageMedia } from './photos'

describe('photos', () => {
  describe('convertDBPhotoToCoreMessageMedia', () => {
    it('should convert DB photo to core message media', () => {
      const dbPhoto: DBSelectPhoto = {
        id: '123',
        message_id: 'msg-456',
        file_id: 'file-789',
        image_bytes: new Uint8Array([1, 2, 3, 4]),
        thumbnail_bytes: null,
        width: null,
        height: null,
        size: null,
        mime_type: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      }

      const result = convertDBPhotoToCoreMessageMedia(dbPhoto)

      expect(result).toEqual({
        type: 'photo',
        messageUUID: 'msg-456',
        byte: new Uint8Array([1, 2, 3, 4]),
        platformId: 'file-789',
      })
    })

    it('should handle photo without message_id', () => {
      const dbPhoto: DBSelectPhoto = {
        id: '123',
        message_id: null,
        file_id: 'file-789',
        image_bytes: new Uint8Array([5, 6, 7]),
        thumbnail_bytes: null,
        width: null,
        height: null,
        size: null,
        mime_type: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      }

      const result = convertDBPhotoToCoreMessageMedia(dbPhoto)

      expect(result).toEqual({
        type: 'photo',
        messageUUID: undefined,
        byte: new Uint8Array([5, 6, 7]),
        platformId: 'file-789',
      })
    })

    it('should handle photo without image_bytes', () => {
      const dbPhoto: DBSelectPhoto = {
        id: '123',
        message_id: 'msg-456',
        file_id: 'file-789',
        image_bytes: null,
        thumbnail_bytes: null,
        width: null,
        height: null,
        size: null,
        mime_type: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      }

      const result = convertDBPhotoToCoreMessageMedia(dbPhoto)

      expect(result).toEqual({
        type: 'photo',
        messageUUID: 'msg-456',
        byte: undefined,
        platformId: 'file-789',
      })
    })

    it('should always set type to photo', () => {
      const dbPhoto: DBSelectPhoto = {
        id: '123',
        message_id: 'msg-456',
        file_id: 'file-789',
        image_bytes: null,
        thumbnail_bytes: null,
        width: null,
        height: null,
        size: null,
        mime_type: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      }

      const result = convertDBPhotoToCoreMessageMedia(dbPhoto)

      expect(result.type).toBe('photo')
    })

    it('should preserve file_id as platformId', () => {
      const dbPhoto: DBSelectPhoto = {
        id: '123',
        message_id: 'msg-456',
        file_id: 'unique-file-identifier-12345',
        image_bytes: null,
        thumbnail_bytes: null,
        width: null,
        height: null,
        size: null,
        mime_type: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      }

      const result = convertDBPhotoToCoreMessageMedia(dbPhoto)

      expect(result.platformId).toBe('unique-file-identifier-12345')
    })
  })
})
