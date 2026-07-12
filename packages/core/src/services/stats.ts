import type { MessageRecord, StatsInput, StatsResult } from '@tg-search/protocol'

export function calculateStats(messages: MessageRecord[], input: StatsInput): StatsResult {
  const groups = Map.groupBy(messages, (message) => {
    if (input.groupBy === 'chat')
      return message.chatId
    if (input.groupBy === 'sender')
      return message.senderId
    return new Date(message.timestamp * 1000).toISOString().slice(0, 7)
  })

  return {
    total: messages.length,
    buckets: [...groups.entries()]
      .map(([key, items]) => ({
        key,
        count: items.length,
        firstTimestamp: Math.min(...items.map(item => item.timestamp)),
        lastTimestamp: Math.max(...items.map(item => item.timestamp)),
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  }
}
