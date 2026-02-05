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
