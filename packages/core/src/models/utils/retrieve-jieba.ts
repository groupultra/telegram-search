import type { Logger } from '@guiiai/logg'
import type { CorePagination } from '@tg-search/common'

import type { CoreDB } from '../../db'
import type { DBRetrievalMessages } from './message'

import { and, eq, inArray, sql } from 'drizzle-orm'

import { accountJoinedChatsTable } from '../../schemas/account-joined-chats'
import { chatMessagesTable } from '../../schemas/chat-messages'
import { joinedChatsTable } from '../../schemas/joined-chats'
import { ensureJieba } from '../../utils/jieba'

export async function retrieveJieba(
  db: CoreDB,
  logger: Logger,
  accountId: string,
  chatId: string | undefined, // Legacy support
  content: string,
  pagination?: CorePagination,
  filters?: {
    fromUserId?: string
    timeRange?: { start?: number, end?: number }
    chatIds?: string[]
  },
): Promise<DBRetrievalMessages[]> {
  logger = logger.withContext('models:retrieve-jieba')

  const jieba = await ensureJieba(logger)
  const jiebaTokens = jieba?.cut(content) || []
  if (jiebaTokens.length === 0) {
    return []
  }

  logger.withFields({
    chatId,
    content,
    jiebaTokens,
  }).debug('Retrieving jieba tokens')

  // Build where conditions
  const whereConditions = [
    eq(chatMessagesTable.platform, 'telegram'),
    filters?.chatIds?.length
      ? inArray(chatMessagesTable.in_chat_id, filters.chatIds)
      : (chatId ? eq(chatMessagesTable.in_chat_id, chatId) : undefined),

    sql`${chatMessagesTable.jieba_tokens} @> ${JSON.stringify(jiebaTokens)}::jsonb`,
    filters?.fromUserId ? eq(chatMessagesTable.from_id, filters.fromUserId) : undefined,
    filters?.timeRange?.start ? sql`${chatMessagesTable.platform_timestamp} >= ${filters.timeRange.start}` : undefined,
    filters?.timeRange?.end ? sql`${chatMessagesTable.platform_timestamp} <= ${filters.timeRange.end}` : undefined,
    // ACL: for private dialogs, only return messages owned by this account (or legacy NULL owner).
    sql`(
      ${joinedChatsTable.chat_type} != 'user'
      OR ${chatMessagesTable.owner_account_id} = ${accountId}
      OR ${chatMessagesTable.owner_account_id} IS NULL
    )`,
  ].filter(Boolean)

  return await db
    .select({
      id: chatMessagesTable.id,
      platform: chatMessagesTable.platform,
      platform_message_id: chatMessagesTable.platform_message_id,
      from_id: chatMessagesTable.from_id,
      from_name: chatMessagesTable.from_name,
      from_user_uuid: chatMessagesTable.from_user_uuid,
      in_chat_id: chatMessagesTable.in_chat_id,
      in_chat_type: chatMessagesTable.in_chat_type,
      content: chatMessagesTable.content,
      is_reply: chatMessagesTable.is_reply,
      reply_to_name: chatMessagesTable.reply_to_name,
      reply_to_id: chatMessagesTable.reply_to_id,
      created_at: chatMessagesTable.created_at,
      updated_at: chatMessagesTable.updated_at,
      deleted_at: chatMessagesTable.deleted_at,
      platform_timestamp: chatMessagesTable.platform_timestamp,
      jieba_tokens: chatMessagesTable.jieba_tokens,
      owner_account_id: chatMessagesTable.owner_account_id,
      chat_name: joinedChatsTable.chat_name,
    })
    .from(chatMessagesTable)
    .innerJoin(joinedChatsTable, eq(chatMessagesTable.in_chat_id, joinedChatsTable.chat_id))
    .innerJoin(
      accountJoinedChatsTable,
      and(
        eq(accountJoinedChatsTable.joined_chat_id, joinedChatsTable.id),
        eq(accountJoinedChatsTable.account_id, accountId),
      ),
    )
    .where(and(...whereConditions))
    .limit(pagination?.limit || 20)
}
