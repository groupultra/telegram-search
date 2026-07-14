import type { MessageRecord, StatsInput, StatsResult } from '@tg-search/protocol'

import { monthKey } from '../utils/month-key'

export function calculateStats(messages: MessageRecord[], input: StatsInput): StatsResult {
  const accumulator = createStatsAccumulator(input)
  accumulator.add(messages)
  return accumulator.result()
}

export function createStatsAccumulator(input: StatsInput) {
  const buckets = new Map<string, { count: number, firstTimestamp: number, lastTimestamp: number }>()
  let total = 0

  function bucketKey(message: MessageRecord): string {
    if (input.groupBy === 'chat')
      return message.chatId
    if (input.groupBy === 'sender')
      return message.senderId
    return monthKey(message.timestamp, input.timeZone)
  }

  return {
    add(messages: Iterable<MessageRecord>) {
      for (const message of messages) {
        const key = bucketKey(message)
        const bucket = buckets.get(key)
        if (bucket) {
          bucket.count += 1
          bucket.firstTimestamp = Math.min(bucket.firstTimestamp, message.timestamp)
          bucket.lastTimestamp = Math.max(bucket.lastTimestamp, message.timestamp)
        }
        else {
          buckets.set(key, { count: 1, firstTimestamp: message.timestamp, lastTimestamp: message.timestamp })
        }
        total += 1
      }
    },
    result(): StatsResult {
      return {
        total,
        buckets: [...buckets.entries()]
          .map(([key, bucket]) => ({ key, ...bucket }))
          .sort((a, b) => a.key.localeCompare(b.key)),
      }
    },
  }
}
