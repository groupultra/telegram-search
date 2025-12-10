import type { CoreDB } from '../db'

import { Ok } from '@unbird/result'
import { eq } from 'drizzle-orm'

import { accountJoinedChatsTable } from '../schemas/account-joined-chats'

export type DBInsertAccountJoinedChat = typeof accountJoinedChatsTable.$inferInsert
export type DBSelectAccountJoinedChat = typeof accountJoinedChatsTable.$inferSelect

/**
 * Link an account to a joined chat
 */
export async function linkAccountToJoinedChat(db: CoreDB, accountId: string, joinedChatId: string) {
  const rows = await db
    .insert(accountJoinedChatsTable)
    .values({
      account_id: accountId,
      joined_chat_id: joinedChatId,
    })
    .onConflictDoNothing()
    .returning()

  return Ok(rows)
}

/**
 * Find all joined_chat_ids for a given account
 */
export async function findJoinedChatIdsByAccountId(db: CoreDB, accountId: string) {
  const results = await db
    .select({
      joined_chat_id: accountJoinedChatsTable.joined_chat_id,
    })
    .from(accountJoinedChatsTable)
    .where(eq(accountJoinedChatsTable.account_id, accountId))

  return Ok(results.map(r => r.joined_chat_id))
}

/**
 * Find all account_ids for a given joined_chat
 */
export async function findAccountIdsByJoinedChatId(db: CoreDB, joinedChatId: string) {
  const results = await db
    .select({
      account_id: accountJoinedChatsTable.account_id,
    })
    .from(accountJoinedChatsTable)
    .where(eq(accountJoinedChatsTable.joined_chat_id, joinedChatId))

  return Ok(results.map(r => r.account_id))
}
