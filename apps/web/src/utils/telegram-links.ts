/**
 * Telegram link generation utilities using t.me URLs.
 *
 * Supports:
 * - User profile links: https://t.me/@id<userId>
 * - Public chat links: https://t.me/<username>
 * - Message links for public channels: https://t.me/<username>/<messageId>
 * - Message links for private channels: https://t.me/c/<channelId>/<messageId>
 */

import type { CoreDialog } from '@tg-search/core/types'

/**
 * Strip Telegram's marked peer-ID prefixes (-100 for channels, - for groups)
 * to get the raw numeric entity ID.
 */
function stripPeerPrefix(id: string): string {
  if (id.startsWith('-100'))
    return id.slice(4)
  if (id.startsWith('-'))
    return id.slice(1)
  return id
}

/**
 * Generate a t.me link to open a chat profile in Telegram.
 * Returns null for chat types that don't support direct linking (private groups without username).
 */
export function getChatLink(chat: Pick<CoreDialog, 'id' | 'type' | 'username'>): string | null {
  if (chat.username)
    return `https://t.me/${chat.username}`

  if (chat.type === 'user' || chat.type === 'bot')
    return `https://t.me/@id${stripPeerPrefix(chat.id.toString())}`

  return null
}

/**
 * Generate a t.me link to open a specific message in Telegram.
 * Returns null for chat types that don't support message linking (DMs, legacy groups).
 */
export function getMessageLink(chat: Pick<CoreDialog, 'id' | 'type' | 'username'>, messageId: string): string | null {
  // Public channels/supergroups/groups with username
  if (chat.username && (chat.type === 'channel' || chat.type === 'supergroup' || chat.type === 'group'))
    return `https://t.me/${chat.username}/${messageId}`

  // Private channels/supergroups
  if (chat.type === 'channel' || chat.type === 'supergroup') {
    const channelId = stripPeerPrefix(chat.id.toString())
    return `https://t.me/c/${channelId}/${messageId}`
  }

  return null
}
