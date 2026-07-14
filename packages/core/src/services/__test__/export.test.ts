import type { MessageRecord } from '@tg-search/protocol'

import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { createExportService } from '../export'

function message(id: string, chatId: string, timestamp: number): MessageRecord {
  return {
    id,
    chatId,
    senderId: 'sender',
    senderName: 'Sender',
    timestamp,
    text: id,
    forward: { isForward: false },
    media: [],
    links: [],
  }
}

describe('local JSONL export', () => {
  it('writes deterministic month files and a checksummed manifest', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'tg-search-export-'))
    const messages = [
      message('2', 'b', 1769904000),
      message('1', 'a', 1767225600),
    ]
    const updates = []

    for await (const update of createExportService(async () => ({ items: messages, nextCursor: null }))({ outputDir, format: 'jsonl', timeZone: 'UTC' })) {
      updates.push(update)
    }

    expect(await readFile(join(outputDir, '2026-01.jsonl'), 'utf8')).toContain('"id":"1"')
    expect(await readFile(join(outputDir, '2026-02.jsonl'), 'utf8')).toContain('"id":"2"')
    const manifest = JSON.parse(await readFile(join(outputDir, 'manifest.json'), 'utf8'))
    expect(manifest.timeZone).toBe('UTC')
    expect(manifest.files).toEqual([
      expect.objectContaining({ file: '2026-01.jsonl', count: 1, sha256: expect.any(String) }),
      expect.objectContaining({ file: '2026-02.jsonl', count: 1, sha256: expect.any(String) }),
    ])
    expect(updates.at(-1)).toMatchObject({ type: 'completed', exported: 2 })
  })

  it('groups month files in the explicitly selected time zone', async () => {
    // A UTC month boundary previously put local New Year messages in December.
    const outputDir = await mkdtemp(join(tmpdir(), 'tg-search-export-timezone-'))
    const messages = [message('new-year', 'a', 1767197312)]

    for await (const _update of createExportService(async () => ({ items: messages, nextCursor: null }))({
      outputDir,
      format: 'jsonl',
      timeZone: 'Asia/Singapore',
    })) {
      // Consume the export stream so all files are committed.
    }

    expect(await readFile(join(outputDir, '2026-01.jsonl'), 'utf8')).toContain('new-year')
  })

  it('writes ordered pages incrementally across a month boundary', async () => {
    // Export previously retained the complete archive before writing any file.
    const outputDir = await mkdtemp(join(tmpdir(), 'tg-search-export-pages-'))
    const pages = new Map([
      [undefined, { items: [message('2', 'b', 1767225601), message('1', 'a', 1767225600)], nextCursor: '2' }],
      ['2', { items: [message('3', 'a', 1769904000)], nextCursor: null }],
    ])

    for await (const _update of createExportService(async cursor => pages.get(cursor)!)({
      outputDir,
      format: 'jsonl',
      timeZone: 'UTC',
    })) {
      // Consume the stream so all pages and files are committed.
    }

    const january = (await readFile(join(outputDir, '2026-01.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line))
    expect(january.map(item => item.id)).toEqual(['1', '2'])
    expect(await readFile(join(outputDir, '2026-02.jsonl'), 'utf8')).toContain('"id":"3"')
  })
})
