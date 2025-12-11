import type { CoreDB } from '../db'
import type { PromiseResult } from '../utils/result'
import type { DBSelectChatMessageStats } from './utils/types'

import { and, eq, sql } from 'drizzle-orm'

import { chatMessagesTable } from '../schemas/chat-messages'
import { joinedChatsTable } from '../schemas/joined-chats'
import { withResult } from '../utils/result'
import { must0 } from './utils/must'

/**
 * Get per-chat message stats for a specific logical account.
 *
 * - For private chats (chat_type = 'user'), only messages owned by this account
 *   (or legacy NULL owner) are counted.
 * - For group/channel chats, messages are shared across accounts and the count
 *   is global (owner_account_id is NULL by design).
 */
export async function getChatMessagesStats(db: CoreDB, accountId: string): PromiseResult<DBSelectChatMessageStats[]> {
  return withResult(() => db
    .select({
      platform: joinedChatsTable.platform,
      chat_id: joinedChatsTable.chat_id,
      chat_name: joinedChatsTable.chat_name,
      message_count: sql<number>`COUNT(${chatMessagesTable.id})::int`.as('message_count'),
      first_message_id: sql<number | null>`MIN(${chatMessagesTable.platform_message_id})::bigint`.as('first_message_id'),
      first_message_at: sql<number | null>`MIN(${chatMessagesTable.created_at})`.as('first_message_at'),
      latest_message_id: sql<number | null>`MAX(${chatMessagesTable.platform_message_id})::bigint`.as('latest_message_id'),
      latest_message_at: sql<number | null>`MAX(${chatMessagesTable.created_at})`.as('latest_message_at'),
    })
    .from(joinedChatsTable)
    .leftJoin(
      chatMessagesTable,
      and(
        eq(joinedChatsTable.chat_id, chatMessagesTable.in_chat_id),
        eq(chatMessagesTable.platform, 'telegram'),
        sql`(
          ${joinedChatsTable.chat_type} != 'user'
          OR ${chatMessagesTable.owner_account_id} = ${accountId}
          OR ${chatMessagesTable.owner_account_id} IS NULL
        )`,
      ),
    )
    .where(eq(joinedChatsTable.platform, 'telegram'))
    .groupBy(
      joinedChatsTable.platform,
      joinedChatsTable.chat_id,
      joinedChatsTable.chat_name,
    ),
  )
}

/**
 * Get per-chat message stats for a specific chat.
 */
export async function getChatMessageStatsByChatId(db: CoreDB, accountId: string, chatId: string): PromiseResult<DBSelectChatMessageStats> {
  return withResult(async () => {
    const rows = await db
      .select({
        platform: joinedChatsTable.platform,
        chat_id: joinedChatsTable.chat_id,
        chat_name: joinedChatsTable.chat_name,
        message_count: sql<number>`COUNT(${chatMessagesTable.id})::int`.as('message_count'),
        first_message_id: sql<number | null>`MIN(${chatMessagesTable.platform_message_id})::bigint`.as('first_message_id'),
        first_message_at: sql<number | null>`MIN(${chatMessagesTable.created_at})`.as('first_message_at'),
        latest_message_id: sql<number | null>`MAX(${chatMessagesTable.platform_message_id})::bigint`.as('latest_message_id'),
        latest_message_at: sql<number | null>`MAX(${chatMessagesTable.created_at})`.as('latest_message_at'),
      })
      .from(joinedChatsTable)
      .leftJoin(
        chatMessagesTable,
        and(
          eq(joinedChatsTable.chat_id, chatMessagesTable.in_chat_id),
          eq(chatMessagesTable.platform, 'telegram'),
          sql`(
          ${joinedChatsTable.chat_type} != 'user'
          OR ${chatMessagesTable.owner_account_id} = ${accountId}
          OR ${chatMessagesTable.owner_account_id} IS NULL
        )`,
        ),
      )
      .where(
        and(
          eq(joinedChatsTable.platform, 'telegram'),
          eq(joinedChatsTable.chat_id, chatId),
        ),
      )
      .groupBy(
        joinedChatsTable.platform,
        joinedChatsTable.chat_id,
        joinedChatsTable.chat_name,
      )
      .limit(1)

    return must0(rows)
  })
}
