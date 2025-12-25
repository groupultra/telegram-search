import type { CoreDB } from '../db'
import type { JoinedChatType } from '../schemas/joined-chats'
import type { CoreChatFolder } from '../types'
import type { PromiseResult } from '../utils/result'

import { eq, sql } from 'drizzle-orm'

import { accountJoinedChatsTable } from '../schemas/account-joined-chats'
import { joinedChatsTable } from '../schemas/joined-chats'
import { withResult } from '../utils/result'

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
          else if (info.type === 'group' || info.type === 'supergroup') {
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

      // 4. Prepare update data for ALL chats of this account
      const updateData = []
      for (const [chatIdStr, info] of chatMap.entries()) {
        const folderIds = perChatFolders.get(chatIdStr) || []
        updateData.push({
          account_id: accountId,
          joined_chat_id: info.id,
          folder_ids: folderIds,
        })
      }

      // 5. Batch update in chunks to avoid hitting parameter limits
      const CHUNK_SIZE = 500
      for (let i = 0; i < updateData.length; i += CHUNK_SIZE) {
        const chunk = updateData.slice(i, i + CHUNK_SIZE)
        await tx
          .insert(accountJoinedChatsTable)
          .values(chunk)
          .onConflictDoUpdate({
            target: [accountJoinedChatsTable.account_id, accountJoinedChatsTable.joined_chat_id],
            set: {
              folder_ids: sql`excluded.folder_ids`,
            },
          })
      }
    })
  })
}

export const chatFolderModels = {
  updateChatFolders,
}

export type ChatFolderModels = typeof chatFolderModels
