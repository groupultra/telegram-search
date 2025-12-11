// eslint-disable-next-line unicorn/prefer-node-protocol
import { Buffer } from 'buffer'

import { v4 as uuidv4 } from 'uuid'
import { describe, expect, it } from 'vitest'

import { mockDB } from '../../db/mock'
import { photosTable } from '../../schemas/photos'
import {
  findPhotoByFileId,
  findPhotoByFileIdWithMimeType,
  findPhotoByQueryId,
  findPhotosByMessageId,
  findPhotosByMessageIds,
  recordPhotos,
} from '../photos'

async function setupDb() {
  return mockDB({
    photosTable,
  })
}

describe('models/photos', () => {
  it('recordPhotos returns empty array when there is no media with bytes', async () => {
    const db = await setupDb()

    const resultEmpty = await recordPhotos(db, [])
    expect(resultEmpty.unwrap()).toEqual([])

    const resultNoBytes = await recordPhotos(db, [
      {
        type: 'photo',
        platformId: 'file-1',
        messageUUID: 'msg-1',
      },
    ] as any)

    expect(resultNoBytes.unwrap()).toEqual([])

    const all = await db.select().from(photosTable)
    expect(all).toHaveLength(0)
  })

  it('recordPhotos inserts new photos and updates on conflict', async () => {
    const db = await setupDb()

    const firstBytes = Buffer.from([1, 2, 3])
    const secondBytes = Buffer.from([9, 9, 9, 9])
    const messageUUID = uuidv4()

    const first = await recordPhotos(db, [
      {
        type: 'photo',
        platformId: 'file-1',
        messageUUID,
        byte: firstBytes,
      },
    ])

    const inserted = first.unwrap()
    expect(inserted).toHaveLength(1)
    expect(inserted[0].file_id).toBe('file-1')

    const second = await recordPhotos(db, [
      {
        type: 'photo',
        platformId: 'file-1',
        messageUUID,
        byte: secondBytes,
      },
    ])

    const updated = second.unwrap()
    expect(updated).toHaveLength(1)

    const [photo] = await db.select().from(photosTable)
    expect(photo.image_bytes).toBeInstanceOf(Buffer)
    expect((photo.image_bytes as Buffer).length).toBe(secondBytes.length)
  })

  it('findPhotoByFileId and findPhotoByQueryId return the correct photo', async () => {
    const db = await setupDb()

    const [inserted] = await db.insert(photosTable).values({
      platform: 'telegram',
      file_id: 'file-42',
      message_id: '00000000-0000-0000-0000-000000000042',
      image_bytes: Buffer.from([1]),
      image_mime_type: 'image/jpeg',
    }).returning()

    const byFileId = (await findPhotoByFileId(db, 'file-42')).unwrap()
    expect(byFileId.id).toBe(inserted.id)

    const byQueryId = (await findPhotoByQueryId(db, inserted.id)).unwrap()
    expect(byQueryId.id).toBe(inserted.id)
  })

  it('findPhotoByFileIdWithMimeType returns id and mimeType only', async () => {
    const db = await setupDb()

    const [inserted] = await db.insert(photosTable).values({
      platform: 'telegram',
      file_id: 'file-mime',
      image_mime_type: 'image/png',
    }).returning()

    const result = (await findPhotoByFileIdWithMimeType(db, 'file-mime')).unwrap()

    expect(result.id).toBe(inserted.id)
    expect(result.mimeType).toBe('image/png')
  })

  it('findPhotosByMessageId(s) return all matching photos', async () => {
    const db = await setupDb()

    await db.insert(photosTable).values([
      {
        platform: 'telegram',
        file_id: 'file-a',
        message_id: '00000000-0000-0000-0000-000000000001',
        image_mime_type: 'image/jpeg',
      },
      {
        platform: 'telegram',
        file_id: 'file-b',
        message_id: '00000000-0000-0000-0000-000000000001',
        image_mime_type: 'image/jpeg',
      },
      {
        platform: 'telegram',
        file_id: 'file-c',
        message_id: '00000000-0000-0000-0000-000000000002',
        image_mime_type: 'image/jpeg',
      },
    ])

    const forMsg1 = (await findPhotosByMessageId(db, '00000000-0000-0000-0000-000000000001')).unwrap()
    expect(forMsg1.map(p => p.file_id).sort()).toEqual(['file-a', 'file-b'])

    const forBoth = (await findPhotosByMessageIds(db, [
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',
    ])).unwrap()
    expect(forBoth.map(p => p.file_id).sort()).toEqual(['file-a', 'file-b', 'file-c'])
  })
})
