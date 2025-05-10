import type { CorePagination } from '../../utils/pagination'
import type { DBRetrivalMessages } from './message'

import { useLogger } from '@tg-search/common'
import { and, eq, sql } from 'drizzle-orm'
import { cut } from 'nodejieba'

import { withDb } from '../../db'
import { chatMessagesTable } from '../../db/schema'

export async function retriveJieba(chatId: string, content: string, pagination?: CorePagination): Promise<DBRetrivalMessages[]> {
  const logger = useLogger('models:retrive-jieba')

  const jiebaTokens = cut(content)

  if (jiebaTokens.length === 0) {
    return []
  }

  logger.withFields({
    chatId,
    content,
    jiebaTokens,
  }).debug('Retriving jieba tokens')

  return (await withDb(db => db
    .select({
      id: chatMessagesTable.id,
      platform: chatMessagesTable.platform,
      platform_message_id: chatMessagesTable.platform_message_id,
      from_id: chatMessagesTable.from_id,
      from_name: chatMessagesTable.from_name,
      in_chat_id: chatMessagesTable.in_chat_id,
      content: chatMessagesTable.content,
      is_reply: chatMessagesTable.is_reply,
      reply_to_name: chatMessagesTable.reply_to_name,
      reply_to_id: chatMessagesTable.reply_to_id,
      created_at: chatMessagesTable.created_at,
      updated_at: chatMessagesTable.updated_at,
      deleted_at: chatMessagesTable.deleted_at,
      platform_timestamp: chatMessagesTable.platform_timestamp,
      jieba_tokens: chatMessagesTable.jieba_tokens,
    })
    .from(chatMessagesTable)
    .where(and(
      eq(chatMessagesTable.platform, 'telegram'),
      eq(chatMessagesTable.in_chat_id, chatId),
      sql`${chatMessagesTable.jieba_tokens} @> ${JSON.stringify(jiebaTokens)}::jsonb`,
    ))
    .limit(pagination?.limit || 20),
  )).expect('Failed to fetch text relevant messages')
}
