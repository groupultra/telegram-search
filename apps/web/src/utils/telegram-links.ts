/**
 * Telegram link generation utilities.
 *
 * Uses t.me URLs where possible, falls back to tg:// for user profiles by ID
 * (no t.me equivalent exists for opening a user profile by numeric ID).
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
 * Generate a link to open a user's profile in Telegram.
 * Uses tg:// protocol since t.me has no equivalent for user IDs without usernames.
 */
export function getUserProfileLink(userId: string): string {
  return `tg://user?id=${stripPeerPrefix(userId)}`
}

/**
 * Generate a link to open a chat/user/channel profile in Telegram.
 * Returns null for private groups without username (not linkable).
 */
export function getChatLink(chat: Pick<CoreDialog, 'id' | 'type' | 'username'>): string | null {
  if (chat.username)
    return `https://t.me/${chat.username}`

  if (chat.type === 'user' || chat.type === 'bot')
    return getUserProfileLink(chat.id.toString())

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
