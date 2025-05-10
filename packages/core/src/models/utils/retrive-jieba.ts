import type { CorePagination } from '../../utils/pagination'
import type { DBRetrivalMessages } from '../chat-message'

import { and, desc, eq, sql } from 'drizzle-orm'
import { cut } from 'nodejieba'

import { withDb } from '../../db'
import { chatMessagesTable } from '../../db/schema'

export async function retriveJieba(chatId: string, content: string, pagination?: CorePagination): Promise<DBRetrivalMessages[]> {
  // const jiebaTokens = cut(content)

  // return (await withDb(db => db
  //   .select({
  //     id: chatMessagesTable.id,
  //     platform: chatMessagesTable.platform,
  //     platform_message_id: chatMessagesTable.platform_message_id,
  //     from_id: chatMessagesTable.from_id,
  //     from_name: chatMessagesTable.from_name,
  //     in_chat_id: chatMessagesTable.in_chat_id,
  //     content: chatMessagesTable.content,
  //     is_reply: chatMessagesTable.is_reply,
  //     reply_to_name: chatMessagesTable.reply_to_name,
  //     reply_to_id: chatMessagesTable.reply_to_id,
  //     created_at: chatMessagesTable.created_at,
  //     updated_at: chatMessagesTable.updated_at,
  //     jieba_tokens: chatMessagesTable.jieba_tokens,
  //     // Based on the number of matching tokens divided by the number of query tokens
  //     similarity: sql<number>`(
  //       SELECT COUNT(*) 
  //       FROM jsonb_array_elements_text(${chatMessagesTable.jieba_tokens}) as token 
  //       WHERE token = ANY(${jiebaTokens})
  //     )::float / ${jiebaTokens.length} AS "similarity"`,
  //     time_relevance: sql<number>`(1 - (CEIL(EXTRACT(EPOCH FROM NOW()) * 1000)::bigint - ${chatMessagesTable.created_at}) / 86400 / 30) AS "time_relevance"`,
  //   })
  //   .from(chatMessagesTable)
  //   .where(and(
  //     eq(chatMessagesTable.platform, 'telegram'),
  //     eq(chatMessagesTable.in_chat_id, chatId),
  //     sql`${chatMessagesTable.jieba_tokens} && jsonb_build_array(${sql.join(jiebaTokens.map(t => sql`${t}`), sql`, `)})`,
  //   ))
  //   .orderBy(desc(sql`similarity`))
  //   .limit(pagination?.limit || 20),
  // )).expect('Failed to fetch text relevant messages')

  return []
}
