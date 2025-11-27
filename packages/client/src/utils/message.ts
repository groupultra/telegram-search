import type { CoreMessage } from '@tg-search/core'

import type { MessageWindow } from '../composables/useMessageWindow'

/**
 * Format Unix timestamp to localized date/time string
 * @param timestamp - Unix timestamp in seconds
 * @returns Formatted date/time string or empty string if timestamp is invalid
 */
export function formatMessageTimestamp(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp < 0)
    return ''
  return new Date(timestamp * 1000).toLocaleString()
}

export function determineMessageDirection(
  messages: CoreMessage[],
  messageWindow: MessageWindow | undefined,
): 'older' | 'newer' | 'initial' {
  if (messages.length === 0 || !messageWindow)
    return 'initial'

  const currentMinId = messageWindow.minId
  const currentMaxId = messageWindow.maxId

  // Sort messages to get their ID range
  const sortedMessages = messages.sort((a, b) => Number(a.platformMessageId) - Number(b.platformMessageId))
  const newMinId = Number(sortedMessages[0].platformMessageId)
  const newMaxId = Number(sortedMessages[sortedMessages.length - 1].platformMessageId)

  // If window has messages, determine direction
  if (currentMinId !== Infinity && currentMaxId !== -Infinity) {
    if (newMaxId < currentMinId) {
      return 'older' // New messages are older than current window
    }
    else if (newMinId > currentMaxId) {
      return 'newer' // New messages are newer than current window
    }
    else {
      return 'initial' // Overlapping or initial load
    }
  }

  return 'initial'
}
