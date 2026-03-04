/**
 * Telegram deep link generation utilities for opening content in the Telegram client.
 *
 * Supports:
 * - User profile links via tg://user?id=<userId>
 * - Public chat links via tg://resolve?domain=<username>
 * - Message links for public channels: tg://resolve?domain=<username>&post=<messageId>
 * - Message links for private channels: tg://privatepost?channel=<channelId>&post=<messageId>
 */

import type { CoreDialog } from '@tg-search/core/types'

export interface TelegramLink {
  /** tg:// deep link for opening in the native Telegram client */
  tgLink: string
  /** https://t.me/ web fallback link */
  webLink: string
}

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
 */
export function getUserProfileLink(userId: string): TelegramLink {
  const rawId = stripPeerPrefix(userId)
  return {
    tgLink: `tg://user?id=${rawId}`,
    webLink: `https://t.me/@id${rawId}`,
  }
}

/**
 * Generate a link to open a chat (channel/group/user) in Telegram.
 * Returns null for chat types that don't support direct linking (legacy groups).
 */
export function getChatProfileLink(chat: Pick<CoreDialog, 'id' | 'type' | 'username'>): TelegramLink | null {
  if (chat.username) {
    return {
      tgLink: `tg://resolve?domain=${chat.username}`,
      webLink: `https://t.me/${chat.username}`,
    }
  }

  if (chat.type === 'user' || chat.type === 'bot') {
    return getUserProfileLink(chat.id.toString())
  }

  // Private channels/supergroups without a username can't be directly opened
  // via deep link without a message ID
  return null
}

/**
 * Generate a link to open a specific message in Telegram.
 * Returns null for chat types that don't support message deep linking (DMs, legacy groups).
 */
export function getMessageLink(chat: Pick<CoreDialog, 'id' | 'type' | 'username'>, messageId: string): TelegramLink | null {
  // Public channels/supergroups with username
  if (chat.username && (chat.type === 'channel' || chat.type === 'supergroup')) {
    return {
      tgLink: `tg://resolve?domain=${chat.username}&post=${messageId}`,
      webLink: `https://t.me/${chat.username}/${messageId}`,
    }
  }

  // Private channels/supergroups
  if (chat.type === 'channel' || chat.type === 'supergroup') {
    const channelId = stripPeerPrefix(chat.id.toString())
    return {
      tgLink: `tg://privatepost?channel=${channelId}&post=${messageId}`,
      webLink: `https://t.me/c/${channelId}/${messageId}`,
    }
  }

  // Groups with username (rare but possible for supergroups detected as groups)
  if (chat.username && chat.type === 'group') {
    return {
      tgLink: `tg://resolve?domain=${chat.username}&post=${messageId}`,
      webLink: `https://t.me/${chat.username}/${messageId}`,
    }
  }

  // Legacy groups and DMs don't support message deep linking
  return null
}
