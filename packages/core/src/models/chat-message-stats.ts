import { and, eq } from 'drizzle-orm'

import { withDb } from '../db'
import { chatMessageStatsView } from '../db/schema'

export async function getChatMessagesStats() {
  return (await withDb(db => db
    .select()
    .from(chatMessageStatsView)
    .where(eq(chatMessageStatsView.platform, 'telegram')),
  )).expect('Failed to fetch chat message stats')
}

export async function getChatMessageStatsByChatId(chatId: string) {
  const res = (await withDb(db => db
    .select()
    .from(chatMessageStatsView)
    .where(
      and(
        eq(chatMessageStatsView.platform, 'telegram'),
        eq(chatMessageStatsView.chat_id, chatId),
      ),
    )
    .limit(1),
  )).expect('Failed to fetch chat message stats by chat ID')

  return res[0]
}
