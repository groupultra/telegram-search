// https://github.com/moeru-ai/airi/blob/main/services/telegram-bot/src/models/chats.ts

import { eq, sql } from 'drizzle-orm'

import { useDrizzle } from '../db'
import { joinedChatsTable } from '../db/schema'

export async function listJoinedChats() {
  return await useDrizzle()
    .select()
    .from(joinedChatsTable)
    .where(eq(joinedChatsTable.platform, 'telegram'))
    .limit(20)
}

export async function recordJoinedChats(chats: { chatId: string, chatName: string }[]) {
  return useDrizzle()
    .insert(joinedChatsTable)
    .values(chats.map(chat => ({
      platform: 'telegram',
      chat_id: chat.chatId,
      chat_name: chat.chatName,
    })))
    .onConflictDoUpdate({
      target: joinedChatsTable.chat_id,
      set: {
        chat_name: sql`excluded.chat_name`,
        updated_at: Date.now(),
      },
    })
}
