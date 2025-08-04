import type { CorePagination } from '@tg-search/common/utils/pagination'

import type { DBRetrievalMessages } from './message'

import { existsSync, readFileSync } from 'node:fs'

import { Jieba } from '@node-rs/jieba'
import { useConfig } from '@tg-search/common/node'
import { useLogger } from '@unbird/logg'
import { and, eq, sql } from 'drizzle-orm'

import { withDb } from '../../drizzle'
import { chatMessagesTable } from '../../schemas/chat_messages'

let _jieba: Jieba | undefined

export function ensureJieba() {
  const logger = useLogger('models:retrieve-jieba')

  if (!_jieba) {
    const dictPath = useConfig().path.dict
    if (existsSync(dictPath)) {
      logger.withFields({ dictPath }).log('Loading jieba dict')
      _jieba = Jieba.withDict(readFileSync(dictPath))
    }
  }

  return _jieba
}

export async function retrieveJieba(chatId: string | undefined, content: string, pagination?: CorePagination): Promise<DBRetrievalMessages[]> {
  const logger = useLogger('models:retrieve-jieba')

  const jieba = ensureJieba()
  const jiebaTokens = jieba?.cut(content) || []
  if (jiebaTokens.length === 0) {
    return []
  }

  logger.withFields({
    chatId,
    content,
    jiebaTokens,
  }).debug('Retrieving jieba tokens')

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
      chatId ? eq(chatMessagesTable.in_chat_id, chatId) : undefined,
      sql`${chatMessagesTable.jieba_tokens} @> ${JSON.stringify(jiebaTokens)}::jsonb`,
    ))
    .limit(pagination?.limit || 20),
  )).expect('Failed to fetch text relevant messages')
}
