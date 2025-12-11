import type { DBSelectPhoto } from './types'

import { Buffer } from 'node:buffer'

import { describe, expect, it } from 'vitest'

import { convertDBPhotoToCoreMessageMedia } from './photos'

describe('photos', () => {
  describe('convertDBPhotoToCoreMessageMedia', () => {
    it('should convert DB photo to core message media', () => {
      const dbPhoto: DBSelectPhoto = {
        id: '123',
        platform: 'telegram',
        message_id: 'msg-456',
        file_id: 'file-789',
        image_bytes: Buffer.from([1, 2, 3, 4]),
        image_path: '',
        caption: '',
        description: '',
        image_height: 0,
        image_width: 0,
        image_mime_type: 'image/jpeg',
        image_thumbnail_bytes: Buffer.from([1, 2, 3, 4]),
        image_thumbnail_path: '',
        description_vector_1536: null,
        description_vector_1024: null,
        description_vector_768: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      }

      const result = convertDBPhotoToCoreMessageMedia(dbPhoto)

      expect(result).toEqual({
        type: 'photo',
        messageUUID: 'msg-456',
        platformId: 'file-789',
        queryId: '123',
      })
    })

    it('should handle photo without message_id', () => {
      const dbPhoto: DBSelectPhoto = {
        id: '123',
        platform: 'telegram',
        message_id: null,
        file_id: 'file-789',
        image_bytes: Buffer.from([5, 6, 7]),
        image_path: '',
        caption: '',
        description: '',
        image_height: 0,
        image_width: 0,
        image_mime_type: 'image/jpeg',
        image_thumbnail_bytes: Buffer.from([1, 2, 3, 4]),
        image_thumbnail_path: '',
        description_vector_1536: null,
        description_vector_1024: null,
        description_vector_768: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      }

      const result = convertDBPhotoToCoreMessageMedia(dbPhoto)

      expect(result).toEqual({
        type: 'photo',
        messageUUID: undefined,
        platformId: 'file-789',
        queryId: '123',
      })
    })

    it('should handle photo without image_bytes', () => {
      const dbPhoto: DBSelectPhoto = {
        id: '123',
        platform: 'telegram',
        message_id: 'msg-456',
        file_id: 'file-789',
        image_bytes: null,
        image_path: '',
        caption: '',
        description: '',
        image_height: 0,
        image_width: 0,
        image_mime_type: 'image/jpeg',
        image_thumbnail_bytes: Buffer.from([1, 2, 3, 4]),
        image_thumbnail_path: '',
        description_vector_1536: null,
        description_vector_1024: null,
        description_vector_768: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      }

      const result = convertDBPhotoToCoreMessageMedia(dbPhoto)

      expect(result).toEqual({
        type: 'photo',
        messageUUID: 'msg-456',
        platformId: 'file-789',
        queryId: '123',
      })
    })

    it('should always set type to photo', () => {
      const dbPhoto: DBSelectPhoto = {
        id: '123',
        platform: 'telegram',
        message_id: 'msg-456',
        file_id: 'file-789',
        image_bytes: null,
        image_thumbnail_bytes: Buffer.from([1, 2, 3, 4]),
        image_thumbnail_path: '',
        image_mime_type: 'image/jpeg',
        image_width: 0,
        image_height: 0,
        image_path: '',
        caption: '',
        description: '',
        description_vector_1536: null,
        description_vector_1024: null,
        description_vector_768: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      }

      const result = convertDBPhotoToCoreMessageMedia(dbPhoto)

      expect(result.type).toBe('photo')
    })

    it('should preserve file_id as platformId', () => {
      const dbPhoto: DBSelectPhoto = {
        id: '123',
        platform: 'telegram',
        message_id: 'msg-456',
        file_id: 'unique-file-identifier-12345',
        image_bytes: null,
        image_thumbnail_bytes: Buffer.from([1, 2, 3, 4]),
        image_thumbnail_path: '',
        image_mime_type: 'image/jpeg',
        image_width: 0,
        image_height: 0,
        image_path: '',
        caption: '',
        description: '',
        description_vector_1536: null,
        description_vector_1024: null,
        description_vector_768: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      }

      const result = convertDBPhotoToCoreMessageMedia(dbPhoto)

      expect(result.platformId).toBe('unique-file-identifier-12345')
    })
  })
})
