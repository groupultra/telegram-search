// eslint-disable-next-line unicorn/prefer-node-protocol
import { Buffer } from 'buffer'

import { v4 as uuidv4 } from 'uuid'
import { describe, expect, it } from 'vitest'

import { mockDB } from '../../db/mock'
import { stickersTable } from '../../schemas/stickers'
import {
  findStickerByFileId,
  findStickerByQueryId,
  getStickerQueryIdByFileIdWithMimeType,
  recordStickers,
} from '../stickers'

async function setupDb() {
  return mockDB({
    stickersTable,
  })
}

describe('models/stickers', () => {
  it('recordStickers deduplicates by file_id and ignores entries without bytes', async () => {
    const db = await setupDb()

    await recordStickers(db, [
      {
        uuid: uuidv4(),
        type: 'sticker',
        platformId: 'file-1',
        emoji: '😀',
        byte: Buffer.from([1, 2, 3]),
        mimeType: 'image/webp',
      },
      // Duplicate platformId should be ignored by deduplication filter
      {
        uuid: uuidv4(),
        type: 'sticker',
        platformId: 'file-1',
        emoji: '😅',
        byte: Buffer.from([9, 9]),
        mimeType: 'image/webp',
      },
      // No bytes -> ignored by recordStickers
      {
        uuid: uuidv4(),
        type: 'sticker',
        platformId: 'file-2',
        emoji: '🙃',
        mimeType: 'image/webp',
      },
    ])

    const rows = await db.select().from(stickersTable)
    expect(rows).toHaveLength(1)
    expect(rows[0].file_id).toBe('file-1')
    expect(rows[0].emoji).toBe('😀')
    expect(rows[0].sticker_mime_type).toBe('image/webp')
  })

  it('recordStickers can persist external storage path without raw bytes and clears bytes on conflict', async () => {
    const db = await setupDb()

    // Initial insert with inline bytes only.
    await recordStickers(db, [
      {
        uuid: uuidv4(),
        type: 'sticker',
        platformId: 'file-external',
        emoji: '😀',
        byte: Buffer.from([1, 2, 3]),
        mimeType: 'image/webp',
      },
    ])

    let [row] = await db.select().from(stickersTable)
    expect(row.sticker_bytes).toBeInstanceOf(Uint8Array)
    // Default path is an empty string when no external storage is used.
    expect(row.sticker_path).toBe('')

    // Second insert switches to external storage only (no inline bytes).
    await recordStickers(db, [
      {
        uuid: uuidv4(),
        type: 'sticker',
        platformId: 'file-external',
        emoji: '😀',
        storagePath: 'sticker/file-external',
        mimeType: 'image/webp',
      },
    ])

    ;[row] = await db.select().from(stickersTable)

    expect(row.sticker_bytes).toBeNull()
    expect(row.sticker_path).toBe('sticker/file-external')
    expect(row.sticker_mime_type).toBe('image/webp')
  })

  it('recordStickers updates emoji and bytes on conflict', async () => {
    const db = await setupDb()

    await recordStickers(db, [
      {
        uuid: uuidv4(),
        type: 'sticker',
        platformId: 'file-1',
        emoji: '😀',
        byte: Buffer.from([1]),
        mimeType: 'image/webp',
      },
    ])

    await recordStickers(db, [
      {
        uuid: uuidv4(),
        type: 'sticker',
        platformId: 'file-1',
        emoji: '🎉',
        byte: Buffer.from([1, 2, 3, 4]),
        mimeType: 'image/webp',
      },
    ])

    const [row] = await db.select().from(stickersTable)

    expect(row.emoji).toBe('🎉')
    expect(row.sticker_bytes).toBeInstanceOf(Uint8Array)
    expect((row.sticker_bytes as Uint8Array).length).toBe(4)
    expect(row.sticker_mime_type).toBe('image/webp')
  })

  it('findStickerByFileId, getStickerQueryIdByFileId, and findStickerByQueryId work together', async () => {
    const db = await setupDb()

    const [inserted] = await db.insert(stickersTable).values({
      platform: 'telegram',
      name: 'test-pack',
      emoji: '😀',
      label: 'label',
      file_id: 'file-123',
      sticker_mime_type: 'image/webp',
    }).returning()

    const byFileId = (await findStickerByFileId(db, 'file-123')).unwrap()
    expect(byFileId.id).toBe(inserted.id)
    expect(byFileId.sticker_mime_type).toBe('image/webp')

    const queryId = (await getStickerQueryIdByFileIdWithMimeType(db, 'file-123')).unwrap()
    expect(queryId.id).toBe(inserted.id)
    expect(queryId.mimeType).toBe('image/webp')

    const byQueryId = (await findStickerByQueryId(db, inserted.id)).unwrap()
    expect(byQueryId.id).toBe(inserted.id)
    expect(byQueryId.sticker_mime_type).toBe('image/webp')
  })
})
