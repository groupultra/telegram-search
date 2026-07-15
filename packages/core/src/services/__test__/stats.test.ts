import type { MessageRecord } from '@tg-search/protocol'

import { describe, expect, it } from 'vitest'

import { calculateStats, createStatsAccumulator } from '../stats'

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

  it('accumulates large paginated inputs without spreading them into one array', () => {
    // The runtime previously collected every page and spread it into one large
    // array before calculating stats, which made annual archives memory-bound.
    const accumulator = createStatsAccumulator({ groupBy: 'sender', timeZone: 'UTC' })
    const page = Array.from({ length: 10_000 }, (_, index) => ({
      ...newYearMessage,
      id: String(index),
      senderId: index % 2 === 0 ? 'even' : 'odd',
      timestamp: newYearMessage.timestamp + index,
    }))

    for (let index = 0; index < 20; index += 1)
      accumulator.add(page)

    expect(accumulator.result()).toEqual({
      total: 200_000,
      buckets: [
        expect.objectContaining({ key: 'even', count: 100_000 }),
        expect.objectContaining({ key: 'odd', count: 100_000 }),
      ],
    })
  })
})
