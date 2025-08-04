import { Ok } from '@unbird/result'
import { and, eq } from 'drizzle-orm'

import { withDb } from '../drizzle'
import { chatMessageStatsView } from '../schemas/chat_message_stats'

export async function getChatMessagesStats() {
  return withDb(db => db
    .select()
    .from(chatMessageStatsView)
    .where(eq(chatMessageStatsView.platform, 'telegram')),
  )
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

  return Ok(res[0])
}
