// https://github.com/moeru-ai/airi/blob/main/services/telegram-bot/src/db/schema.ts

import { sql } from 'drizzle-orm'
import { bigint, integer, pgView, text } from 'drizzle-orm/pg-core'

// export const chatMessageStatsView = pgView('chat_message_stats', {
//   platform: text().notNull(),
//   chat_id: text().notNull(),
//   chat_name: text().notNull(),
//   message_count: integer().notNull(),
//   latest_message_at: bigint({ mode: 'number' }),
// }).as((qb) => {
//   return qb
//     .select({
//       platform: joinedChatsTable.platform,
//       chat_id: joinedChatsTable.chat_id,
//       chat_name: joinedChatsTable.chat_name,
//       message_count: sql<number>`count(${chatMessagesTable.id})`.as('message_count'),
//       latest_message_at: sql<number>`max(${chatMessagesTable.created_at})`.as('latest_message_at'),
//     })
//     .from(joinedChatsTable)
//     .leftJoin(chatMessagesTable, sql`${joinedChatsTable.chat_id} = ${chatMessagesTable.in_chat_id}`)
//     .groupBy(joinedChatsTable.platform, joinedChatsTable.chat_id, joinedChatsTable.chat_name)
// })

export const chatMessageStatsView = pgView('chat_message_stats', {
  platform: text().notNull(),
  chat_id: text().notNull(),
  chat_name: text().notNull(),
  message_count: integer().notNull(),
  first_message_id: bigint({ mode: 'number' }),
  first_message_at: bigint({ mode: 'number' }),
  latest_message_id: bigint({ mode: 'number' }),
  latest_message_at: bigint({ mode: 'number' }),
}).as(
  sql`
    SELECT 
      jc.platform, 
      jc.chat_id, 
      jc.chat_name, 
      COUNT(cm.id)::int AS message_count,
      MIN(cm.platform_message_id) AS first_message_id,
      MIN(cm.created_at) AS first_message_at,
      MAX(cm.platform_message_id) AS latest_message_id,
      MAX(cm.created_at) AS latest_message_at
    FROM joined_chats jc
    LEFT JOIN chat_messages cm ON jc.chat_id = cm.in_chat_id
    GROUP BY jc.platform, jc.chat_id, jc.chat_name
  `,
)
