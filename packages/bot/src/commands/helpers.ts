import type { CoreDB } from '@tg-search/core'

import { models } from '@tg-search/core'

export interface ChatOption {
  id: string
  name: string
  type: string
  folderIds?: number[]
}

/**
 * Get list of chats for an account (for inline keyboard options)
 */
export async function getAccountChats(db: CoreDB, accountId: string): Promise<ChatOption[]> {
  const result = await models.chatModels.fetchChatsByAccountId(db, accountId)
  const chats = result.expect('Failed to get chats')

  return chats.map(chat => ({
    id: chat.chat_id,
    name: chat.chat_name || chat.chat_id,
    type: chat.chat_type || 'unknown',
    folderIds: chat.folder_ids || [],
  }))
}

/**
 * Remove control characters and lone surrogates from text
 */
export function sanitizeText(text: string): string {
  return text
    // eslint-disable-next-line sonarjs/no-control-regex, no-control-regex
    .replace(/[\u0000-\u0008\v\f\u000E-\u001F\u007F]/g, '')
    .replace(/[\uD800-\uDFFF]/g, '')
    .trim()
}

/**
 * Map chat type to display icon
 */
export function getChatTypeIcon(type: string): string {
  switch (type) {
    case 'group':
    case 'supergroup':
      return '👥'
    case 'channel':
      return '📢'
    default:
      return '💬'
  }
}
