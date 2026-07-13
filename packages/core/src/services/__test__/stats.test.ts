import type { MessageRecord } from '@tg-search/protocol'

import { describe, expect, it } from 'vitest'

import { calculateStats } from '../stats'

const newYearMessage: MessageRecord = {
  id: 'new-year',
  chatId: 'chat',
  senderId: 'sender',
  senderName: 'Sender',
  timestamp: 1767197312,
  text: 'Happy New Year',
  forward: { isForward: false },
  media: [],
  links: [],
}

describe('local message stats', () => {
  it('groups months in the explicitly selected time zone', () => {
    // UTC grouping previously mislabeled a local January message as December.
    const result = calculateStats([newYearMessage], {
      groupBy: 'month',
      timeZone: 'Asia/Singapore',
    })

    expect(result.buckets).toEqual([
      expect.objectContaining({ key: '2026-01', count: 1 }),
    ])
  })
})
