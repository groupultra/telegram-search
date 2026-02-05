import type { CoreDB } from '../db'
import type { CoreChatFolder } from '../types/dialog'
import type { PromiseResult } from '../utils/result'

import { eq } from 'drizzle-orm'

import { accountChatFoldersTable } from '../schemas/account-chat-folders'
import { withResult } from '../utils/result'

/**
 * Find all folders for an account
 */
async function findFoldersByAccountId(db: CoreDB, accountId: string): PromiseResult<CoreChatFolder[]> {
  return withResult(async () => {
    const folders = await db
      .select()
      .from(accountChatFoldersTable)
      .where(eq(accountChatFoldersTable.accountId, accountId))

    return folders.map(folder => ({
      id: folder.folderId,
      title: folder.title,
      emoticon: folder.emoticon || undefined,
      pinnedChatIds: folder.pinnedChatIds || [],
      includedChatIds: folder.includedChatIds || [],
      excludedChatIds: folder.excludedChatIds || [],
      contacts: folder.contacts || undefined,
      nonContacts: folder.nonContacts || undefined,
      groups: folder.groups || undefined,
      broadcasts: folder.broadcasts || undefined,
      bots: folder.bots || undefined,
      excludeMuted: folder.excludeMuted || undefined,
      excludeRead: folder.excludeRead || undefined,
      excludeArchived: folder.excludeArchived || undefined,
    }))
  })
}

/**
 * Upsert (insert or update) folders for an account
 */
async function upsertFolders(db: CoreDB, accountId: string, folders: CoreChatFolder[]): PromiseResult<void> {
  return withResult(async () => {
    await db.transaction(async (tx) => {
      // Delete existing folders for this account
      await tx
        .delete(accountChatFoldersTable)
        .where(eq(accountChatFoldersTable.accountId, accountId))

      // Insert new folders
      if (folders.length > 0) {
        await tx.insert(accountChatFoldersTable).values(
          folders.map(folder => ({
            accountId,
            folderId: folder.id,
            title: folder.title,
            emoticon: folder.emoticon || null,
            pinnedChatIds: folder.pinnedChatIds || [],
            includedChatIds: folder.includedChatIds || [],
            excludedChatIds: folder.excludedChatIds || [],
            contacts: folder.contacts || false,
            nonContacts: folder.nonContacts || false,
            groups: folder.groups || false,
            broadcasts: folder.broadcasts || false,
            bots: folder.bots || false,
            excludeMuted: folder.excludeMuted || false,
            excludeRead: folder.excludeRead || false,
            excludeArchived: folder.excludeArchived || false,
          })),
        )
      }
    })
  })
}

export const accountChatFolderModels = {
  findFoldersByAccountId,
  upsertFolders,
}

export type AccountChatFolderModels = typeof accountChatFolderModels
