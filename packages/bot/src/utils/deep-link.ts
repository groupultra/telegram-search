/**
 * Telegram deep link generation utility.
 *
 * Supports generating links to specific messages in:
 * - Public channels/supergroups (via username)
 * - Private supergroups/channels (via t.me/c/{id}/{msgId} format)
 */

export interface DeepLinkResult {
  type: 'direct' | 'private' | 'unavailable'
  url?: string
  reason?: string
}

export interface ChatLinkInfo {
  chatId: string
  chatType: string // 'user' | 'bot' | 'channel' | 'group' | 'supergroup'
  chatUsername?: string | null
}

/**
 * Generate a Telegram deep link to a specific message.
 *
 * Link formats:
 * - Public channel/supergroup with username: https://t.me/{username}/{messageId}
 * - Private supergroup/channel: https://t.me/c/{numericId}/{messageId}
 * - Groups/DMs: Not linkable (unavailable)
 *
 * @param chat - Chat information including type and username
 * @param messageId - The message ID to link to
 * @returns DeepLinkResult with type, url, and optional reason
 */
export function generateMessageLink(
  chat: ChatLinkInfo,
  messageId: string,
): DeepLinkResult {
  const { chatId, chatType, chatUsername } = chat

  // Public channels/supergroups with username - direct link
  if (chatUsername && (chatType === 'channel' || chatType === 'supergroup')) {
    return {
      type: 'direct',
      url: `https://t.me/${chatUsername}/${messageId}`,
    }
  }

  // Private supergroups/channels - use t.me/c/ format
  // Telegram channel/supergroup IDs are prefixed with -100, remove it for link
  if (chatType === 'channel' || chatType === 'supergroup') {
    const numericId = chatId.startsWith('-100')
      ? chatId.slice(4)
      : chatId.startsWith('-')
        ? chatId.slice(1)
        : chatId
    return {
      type: 'private',
      url: `https://t.me/c/${numericId}/${messageId}`,
    }
  }

  // Groups (non-supergroup) and DMs - no direct link available
  return {
    type: 'unavailable',
    reason: chatType === 'user' || chatType === 'bot'
      ? 'Private chats cannot be linked'
      : 'Legacy groups cannot be linked',
  }
}
