// eslint-disable-next-line unicorn/prefer-node-protocol
import { Buffer } from 'buffer'

import { describe, expect, it } from 'vitest'

import { mockDB } from '../../db/mock'
import { stickersTable } from '../../schemas/stickers'
import {
  findStickerByFileId,
  findStickerByQueryId,
  getStickerQueryIdByFileId,
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
        type: 'sticker',
        platformId: 'file-1',
        emoji: '😀',
        byte: Buffer.from([1, 2, 3]),
      },
      // Duplicate platformId should be ignored by deduplication filter
      {
        type: 'sticker',
        platformId: 'file-1',
        emoji: '😅',
        byte: Buffer.from([9, 9]),
      },
      // No bytes -> ignored by recordStickers
      {
        type: 'sticker',
        platformId: 'file-2',
        emoji: '🙃',
      },
    ] as any)

    const rows = await db.select().from(stickersTable)
    expect(rows).toHaveLength(1)
    expect(rows[0].file_id).toBe('file-1')
    expect(rows[0].emoji).toBe('😀')
  })

  it('recordStickers updates emoji and bytes on conflict', async () => {
    const db = await setupDb()

    await recordStickers(db, [
      {
        type: 'sticker',
        platformId: 'file-1',
        emoji: '😀',
        byte: Buffer.from([1]),
      },
    ] as any)

    await recordStickers(db, [
      {
        type: 'sticker',
        platformId: 'file-1',
        emoji: '🎉',
        byte: Buffer.from([1, 2, 3, 4]),
      },
    ] as any)

    const [row] = await db.select().from(stickersTable)

    expect(row.emoji).toBe('🎉')
    expect(row.sticker_bytes).toBeInstanceOf(Uint8Array)
    expect((row.sticker_bytes as Uint8Array).length).toBe(4)
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

    const queryId = (await getStickerQueryIdByFileId(db, 'file-123')).unwrap()
    expect(queryId.id).toBe(inserted.id)

    const byQueryId = (await findStickerByQueryId(db, inserted.id)).unwrap()
    expect(byQueryId.id).toBe(inserted.id)
  })
})
