// https://github.com/moeru-ai/airi/blob/main/services/telegram-bot/src/models/chats.ts

import type { CoreDialog } from '../index'

import { desc, eq, sql } from 'drizzle-orm'

import { withDb } from '../db'
import { joinedChatsTable } from '../schemas/joined_chats'

export async function fetchChats() {
  return withDb(db => db
    .select()
    .from(joinedChatsTable)
    .where(eq(joinedChatsTable.platform, 'telegram'))
    .orderBy(desc(joinedChatsTable.dialog_date)),
  )
}

export async function recordChats(chats: CoreDialog[]) {
  // TODO: better way to do this?
  return withDb(async db => db
    .insert(joinedChatsTable)
    .values(chats.map(chat => ({
      platform: 'telegram',
      chat_id: chat.id.toString(),
      chat_name: chat.name,
      chat_type: chat.type,
      dialog_date: chat.lastMessageDate ? chat.lastMessageDate.getTime() : 0,
      // created_at: chat.lastMessageDate,
      // updated_at: Date.now(),
    })))
    .onConflictDoUpdate({
      target: joinedChatsTable.chat_id,
      set: {
        chat_name: sql`excluded.chat_name`,
        chat_type: sql`excluded.chat_type`,
        dialog_date: sql`excluded.dialog_date`,
        updated_at: Date.now(), // TODO: is it correct?
      },
    })
    .returning(),
  )
}
