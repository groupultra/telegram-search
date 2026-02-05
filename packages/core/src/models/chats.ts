// https://github.com/moeru-ai/airi/blob/main/services/telegram-bot/src/models/chats.ts

import type { CoreDB } from '../db'
import type { JoinedChatType } from '../schemas/joined-chats'
import type { CoreDialog } from '../types/dialog'
import type { CoreEntity } from '../types/events'
import type { PromiseResult } from '../utils/result'
import type { DBSelectChat, DBSelectChatWithAccount } from './utils/types'

import { and, desc, eq, sql } from 'drizzle-orm'

import { accountJoinedChatsTable } from '../schemas/account-joined-chats'
import { joinedChatsTable } from '../schemas/joined-chats'
import { withResult } from '../utils/result'
import { parseDate } from './utils/time'

/**
 * Record chats for a specific account
 */
async function recordChats(db: CoreDB, chats: CoreDialog[], accountId: string): Promise<DBSelectChat[]> {
  // Use a single transaction so joined_chats and account_joined_chats are consistent
  return db.transaction(async (tx) => {
    // Insert or update joined_chats
    const joinedChats = await tx
      .insert(joinedChatsTable)
      .values(chats.map(chat => ({
        platform: 'telegram',
        chat_id: chat.id.toString(),
        chat_name: chat.name,
        chat_type: chat.type,
        dialog_date: parseDate(chat.lastMessageDate),
      })))
      .onConflictDoUpdate({
        target: joinedChatsTable.chat_id,
        set: {
          chat_name: sql`excluded.chat_name`,
          chat_type: sql`excluded.chat_type`,
          dialog_date: sql`excluded.dialog_date`,
          updated_at: Date.now(),
        },
      })
      .returning()

    // If accountId is provided, automatically link to account_joined_chats
    if (accountId && joinedChats.length > 0) {
      // Check if ANY of the input dialogs contain folder information.
      // If none do (typical for basic getDialogs sync), we should NOT overwrite existing folder mapping in DB.
      const hasFolderData = chats.some(c => c.folderIds !== undefined)

      await tx
        .insert(accountJoinedChatsTable)
        .values(joinedChats.map((chat) => {
          const originalChat = chats.find(c => c.id.toString() === chat.chat_id)
          return {
            account_id: accountId,
            joined_chat_id: chat.id,
            is_pinned: originalChat?.pinned || false,
            is_contact: originalChat?.isContact || false,
            folder_ids: originalChat?.folderIds || [],
            access_hash: originalChat?.accessHash,
          }
        }))
        .onConflictDoUpdate({
          target: [accountJoinedChatsTable.account_id, accountJoinedChatsTable.joined_chat_id],
          set: {
            is_pinned: sql`excluded.is_pinned`,
            is_contact: sql`excluded.is_contact`,
            ...(hasFolderData ? { folder_ids: sql`excluded.folder_ids` } : {}),
            access_hash: sql`excluded.access_hash`,
          },
        })
    }

    return joinedChats
  })
}

/**
 * Fetch all chats
 */
async function fetchChats(db: CoreDB): PromiseResult<DBSelectChat[]> {
  return withResult(() => db.select()
    .from(joinedChatsTable)
    .where(eq(joinedChatsTable.platform, 'telegram'))
    .orderBy(desc(joinedChatsTable.dialog_date)),
  )
}

/**
 * Fetch chats for a specific account
 */
async function fetchChatsByAccountId(db: CoreDB, accountId: string): PromiseResult<DBSelectChatWithAccount[]> {
  return withResult(() => db
    .select({
      id: joinedChatsTable.id,
      platform: joinedChatsTable.platform,
      chat_id: joinedChatsTable.chat_id,
      chat_name: joinedChatsTable.chat_name,
      chat_type: joinedChatsTable.chat_type,
      dialog_date: joinedChatsTable.dialog_date,
      access_hash: accountJoinedChatsTable.access_hash,
      is_pinned: accountJoinedChatsTable.is_pinned,
      is_contact: accountJoinedChatsTable.is_contact,
      folder_ids: accountJoinedChatsTable.folder_ids,
      created_at: joinedChatsTable.created_at,
      updated_at: joinedChatsTable.updated_at,
    })
    .from(joinedChatsTable)
    .innerJoin(
      accountJoinedChatsTable,
      eq(joinedChatsTable.id, accountJoinedChatsTable.joined_chat_id),
    )
    .where(eq(accountJoinedChatsTable.account_id, accountId))
    .orderBy(desc(accountJoinedChatsTable.is_pinned), desc(joinedChatsTable.dialog_date)),
  )
}

/**
 * Check whether a given chat (by Telegram chat_id) is accessible for an account.
 *
 * This is used by higher-level handlers to enforce that message-level access
 * never exceeds the dialogs visible to the account.
 */
async function isChatAccessibleByAccount(db: CoreDB, accountId: string, chatId: string): PromiseResult<boolean> {
  return withResult(async () => {
    const rows = await db
      .select({
        id: joinedChatsTable.id,
      })
      .from(joinedChatsTable)
      .innerJoin(
        accountJoinedChatsTable,
        and(
          eq(accountJoinedChatsTable.joined_chat_id, joinedChatsTable.id),
          eq(accountJoinedChatsTable.account_id, accountId),
        ),
      )
      .where(eq(joinedChatsTable.chat_id, chatId))
      .limit(1)

    return rows.length > 0
  })
}

/**
 * Update the pts for a specific chat for an account.
 * Uses GREATEST() to ensure pts only moves forward.
 */
async function updateChatPts(db: CoreDB, accountId: string, chatId: string, pts: number): Promise<void> {
  // Find the joined_chat id first
  const chat = await db
    .select({ id: joinedChatsTable.id })
    .from(joinedChatsTable)
    .where(eq(joinedChatsTable.chat_id, chatId))
    .limit(1)

  if (chat.length === 0)
    return

  await db
    .update(accountJoinedChatsTable)
    .set({
      pts: sql`GREATEST(${accountJoinedChatsTable.pts}, ${pts})`,
    })
    .where(and(
      eq(accountJoinedChatsTable.account_id, accountId),
      eq(accountJoinedChatsTable.joined_chat_id, chat[0].id),
    ))
}

export const chatModels = {
  recordChats,
  fetchChats,
  fetchChatsByAccountId,
  isChatAccessibleByAccount,
  updateChatPts,
  findChatAccessHash,
  recordChatEntity,
}

export type ChatModels = typeof chatModels

/**
 * Record a single chat entity (without dialog metadata)
 * Requires accountId to persist access_hash in account_joined_chats.
 */
async function recordChatEntity(db: CoreDB, entity: CoreEntity, accountId?: string): Promise<void> {
  let chatType: JoinedChatType = 'group'
  if (entity.type === 'channel') {
    chatType = 'channel'
  }

  const [chat] = await db.insert(joinedChatsTable)
    .values({
      platform: 'telegram',
      chat_id: entity.id,
      chat_name: entity.name,
      chat_type: chatType,
      dialog_date: 0, // Not a dialog sync, so no date
    })
    .onConflictDoUpdate({
      target: joinedChatsTable.chat_id,
      set: {
        chat_name: sql`excluded.chat_name`,
        updated_at: Date.now(),
      },
    })
    .returning()

  if (accountId && chat && entity.accessHash) {
    await db.insert(accountJoinedChatsTable)
      .values({
        account_id: accountId,
        joined_chat_id: chat.id,
        access_hash: entity.accessHash,
      })
      .onConflictDoUpdate({
        target: [accountJoinedChatsTable.account_id, accountJoinedChatsTable.joined_chat_id],
        set: {
          access_hash: sql`excluded.access_hash`,
        },
      })
  }
}

/**
 * Find access hash and type for a specific chat
 */
async function findChatAccessHash(db: CoreDB, accountId: string, chatId: string): PromiseResult<{ accessHash: string, type: string } | null> {
  return withResult(async () => {
    const rows = await db
      .select({
        access_hash: accountJoinedChatsTable.access_hash,
        type: joinedChatsTable.chat_type,
      })
      .from(joinedChatsTable)
      .innerJoin(
        accountJoinedChatsTable,
        and(
          eq(accountJoinedChatsTable.joined_chat_id, joinedChatsTable.id),
          eq(accountJoinedChatsTable.account_id, accountId),
        ),
      )
      .where(eq(joinedChatsTable.chat_id, chatId))
      .limit(1)

    if (rows.length === 0)
      return null
    return { accessHash: rows[0].access_hash || '', type: rows[0].type }
  })
}
