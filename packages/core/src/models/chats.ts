// https://github.com/moeru-ai/airi/blob/main/services/telegram-bot/src/models/chats.ts

import type { CoreDB } from '../db'
import type { JoinedChatType } from '../schemas/joined-chats'
import type { CoreChatFolder, CoreDialog } from '../types/dialog'
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
            folder_ids: sql`excluded.folder_ids`,
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

export const chatModels = {
  recordChats,
  fetchChats,
  fetchChatsByAccountId,
  isChatAccessibleByAccount,
  updateChatFolders,
}

async function updateChatFolders(db: CoreDB, accountId: string, folders: CoreChatFolder[]): PromiseResult<void> {
  return withResult(async () => {
    await db.transaction(async (tx) => {
      // 1. Get all chats for this account
      const chats = await tx
        .select({
          id: joinedChatsTable.id,
          chat_id: joinedChatsTable.chat_id,
          chat_type: joinedChatsTable.chat_type,
          is_contact: accountJoinedChatsTable.is_contact,
        })
        .from(joinedChatsTable)
        .innerJoin(
          accountJoinedChatsTable,
          eq(joinedChatsTable.id, accountJoinedChatsTable.joined_chat_id),
        )
        .where(eq(accountJoinedChatsTable.account_id, accountId))

      // 2. Map chat_id (platform string) to database id (uuid)
      const chatMap = new Map<string, { id: string, type: JoinedChatType, isContact: boolean }>()
      for (const chat of chats) {
        chatMap.set(chat.chat_id, {
          id: chat.id,
          type: chat.chat_type,
          isContact: chat.is_contact || false,
        })
      }

      // 3. Calculate folder IDs for each chat
      const perChatFolders = new Map<string, number[]>()

      for (const folder of folders) {
        // Handle explicit inclusions
        const allIncluded = [...(folder.includedChatIds || []), ...(folder.pinnedChatIds || [])]
        for (const chatId of allIncluded) {
          const chatIdStr = chatId.toString()
          const existing = perChatFolders.get(chatIdStr) || []
          if (!existing.includes(folder.id)) {
            perChatFolders.set(chatIdStr, [...existing, folder.id])
          }
        }

        // Handle flag-based inclusions (only for chats we have in DB)
        for (const [chatIdStr, info] of chatMap.entries()) {
          // Skip if explicitly excluded
          if (folder.excludedChatIds?.includes(Number(chatIdStr))) {
            continue
          }

          let matches = false
          if (info.type === 'user') {
            if (folder.contacts && info.isContact)
              matches = true
            if (folder.nonContacts && !info.isContact)
              matches = true
          }
          else if (info.type === 'bot') {
            if (folder.bots)
              matches = true
          }
          else if (info.type === 'group') {
            if (folder.groups)
              matches = true
          }
          else if (info.type === 'channel') {
            if (folder.broadcasts)
              matches = true
          }

          if (matches) {
            const existing = perChatFolders.get(chatIdStr) || []
            if (!existing.includes(folder.id)) {
              perChatFolders.set(chatIdStr, [...existing, folder.id])
            }
          }
        }
      }

      // 4. Update database
      for (const [chatIdStr, folderIds] of perChatFolders.entries()) {
        const info = chatMap.get(chatIdStr)
        if (info) {
          await tx
            .update(accountJoinedChatsTable)
            .set({
              folder_ids: folderIds,
            })
            .where(
              and(
                eq(accountJoinedChatsTable.account_id, accountId),
                eq(accountJoinedChatsTable.joined_chat_id, info.id),
              ),
            )
        }
      }
    })
  })
}

export type ChatModels = typeof chatModels
