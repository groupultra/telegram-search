import type { CoreDB } from '../db'
import type { PromiseResult } from '../utils/result'
import type { DBSelectAccountJoinedChat } from './utils/types'

import { eq } from 'drizzle-orm'

import { accountJoinedChatsTable } from '../schemas/account-joined-chats'
import { withResult } from '../utils/result'
import { must0 } from './utils/must'

/**
 * Link an account to a joined chat
 */
async function linkAccountToJoinedChat(db: CoreDB, accountId: string, joinedChatId: string): Promise<DBSelectAccountJoinedChat> {
  const rows = await db
    .insert(accountJoinedChatsTable)
    .values({
      account_id: accountId,
      joined_chat_id: joinedChatId,
    })
    .onConflictDoNothing()
    .returning()

  return must0(rows)
}

/**
 * Find all joined_chat_ids for a given account
 */
async function findJoinedChatIdsByAccountId(db: CoreDB, accountId: string): PromiseResult<string[]> {
  return withResult(async () => {
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
async function findAccountIdsByJoinedChatId(db: CoreDB, joinedChatId: string): PromiseResult<string[]> {
  return withResult(async () => {
    const results = await db
      .select({
        account_id: accountJoinedChatsTable.account_id,
      })
      .from(accountJoinedChatsTable)
      .where(eq(accountJoinedChatsTable.joined_chat_id, joinedChatId))

    return results.map(r => r.account_id)
  })
}

export const accountJoinedChatModels = {
  linkAccountToJoinedChat,
  findJoinedChatIdsByAccountId,
  findAccountIdsByJoinedChatId,
}

export type AccountJoinedChatModels = typeof accountJoinedChatModels
