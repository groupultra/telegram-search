import { eq } from 'drizzle-orm'

import { withDb } from '../db'
import { accountJoinedChatsTable } from '../schemas/account-joined-chats'

export type DBInsertAccountJoinedChat = typeof accountJoinedChatsTable.$inferInsert
export type DBSelectAccountJoinedChat = typeof accountJoinedChatsTable.$inferSelect

/**
 * Link an account to a joined chat
 */
export async function linkAccountToJoinedChat(accountId: string, joinedChatId: string) {
  const dbLink: DBInsertAccountJoinedChat = {
    account_id: accountId,
    joined_chat_id: joinedChatId,
  }

  return withDb(async db => db
    .insert(accountJoinedChatsTable)
    .values(dbLink)
    .onConflictDoNothing()
    .returning(),
  )
}

/**
 * Find all joined_chat_ids for a given account
 */
export async function findJoinedChatIdsByAccountId(accountId: string) {
  return withDb(async (db) => {
    const results = await db
      .select({
        joined_chat_id: accountJoinedChatsTable.joined_chat_id,
      })
      .from(accountJoinedChatsTable)
      .where(eq(accountJoinedChatsTable.account_id, accountId))

    return results.map(r => r.joined_chat_id)
  })
}

/**
 * Find all account_ids for a given joined_chat
 */
export async function findAccountIdsByJoinedChatId(joinedChatId: string) {
  return withDb(async (db) => {
    const results = await db
      .select({
        account_id: accountJoinedChatsTable.account_id,
      })
      .from(accountJoinedChatsTable)
      .where(eq(accountJoinedChatsTable.joined_chat_id, joinedChatId))

    return results.map(r => r.account_id)
  })
}
