import type { CoreChatFolder } from '../../types/dialog'

import { and, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { mockDB } from '../../db/mock'
import { accountJoinedChatsTable } from '../../schemas/account-joined-chats'
import { accountsTable } from '../../schemas/accounts'
import { joinedChatsTable } from '../../schemas/joined-chats'
import { chatFolderModels } from '../chat-folders'

async function setupDb() {
  return mockDB({
    accountsTable,
    joinedChatsTable,
    accountJoinedChatsTable,
  })
}

describe('models/chats updateChatFolders', () => {
  it('correctly maps chats to folders based on criteria', async () => {
    const db = await setupDb()

    // 1. Arrange: Setup Account and Chats
    const [account] = await db.insert(accountsTable).values({
      platform: 'telegram',
      platform_user_id: 'test-user',
    }).returning()

    const chatData = [
      { id: '100', name: 'Contact User', type: 'user', isContact: true },
      { id: '200', name: 'Group Chat', type: 'group', isContact: false },
      { id: '300', name: 'Channel', type: 'channel', isContact: false },
      { id: '400', name: 'Bot', type: 'bot', isContact: false },
      { id: '500', name: 'Non-Contact User', type: 'user', isContact: false },
      { id: '600', name: 'Supergroup', type: 'supergroup', isContact: false },
    ]

    for (const data of chatData) {
      const [chat] = await db.insert(joinedChatsTable).values({
        platform: 'telegram',
        chat_id: data.id,
        chat_name: data.name,
        chat_type: data.type as any,
        dialog_date: Date.now(),
      }).returning()

      await db.insert(accountJoinedChatsTable).values({
        account_id: account.id,
        joined_chat_id: chat.id,
        is_contact: data.isContact,
      })
    }

    // 2. Define Folders
    const folders: CoreChatFolder[] = [
      {
        id: 1,
        title: 'Contacts',
        contacts: true,
        includedChatIds: [],
        excludedChatIds: [],
      },
      {
        id: 2,
        title: 'Groups & Bots',
        groups: true,
        bots: true,
        includedChatIds: [],
        excludedChatIds: [],
      },
      {
        id: 3,
        title: 'Manual & Pinned',
        includedChatIds: [300],
        pinnedChatIds: [500],
        excludedChatIds: [],
      },
      {
        id: 4,
        title: 'Broadcasts with Exclusion',
        broadcasts: true,
        includedChatIds: [],
        excludedChatIds: [300],
      },
      {
        id: 5,
        title: 'Non-Contacts',
        nonContacts: true,
        includedChatIds: [],
        excludedChatIds: [],
      },
    ]

    // 3. Act
    await chatFolderModels.updateChatFolders(db, account.id, folders)

    // 4. Assert
    const results = await db
      .select({
        chat_id: joinedChatsTable.chat_id,
        folder_ids: accountJoinedChatsTable.folder_ids,
      })
      .from(accountJoinedChatsTable)
      .innerJoin(joinedChatsTable, eq(accountJoinedChatsTable.joined_chat_id, joinedChatsTable.id))
      .where(eq(accountJoinedChatsTable.account_id, account.id))

    const resultMap = new Map(results.map(r => [r.chat_id, r.folder_ids || []]))

    // Chat 100: User (Contact) -> Folder 1 (Contacts), NOT Folder 5 (Non-Contacts)
    expect(resultMap.get('100')).toContain(1)
    expect(resultMap.get('100')).not.toContain(5)

    // Chat 200: Group -> Folder 2
    expect(resultMap.get('200')).toContain(2)

    // Chat 300: Channel -> Folder 3 (Manual), NOT Folder 4 (Excluded)
    expect(resultMap.get('300')).toContain(3)
    expect(resultMap.get('300')).not.toContain(4)

    // Chat 400: Bot -> Folder 2
    expect(resultMap.get('400')).toContain(2)

    // Chat 500: User (Non-Contact) -> Folder 3 (Pinned), Folder 5 (Non-Contacts)
    expect(resultMap.get('500')).toContain(3)
    expect(resultMap.get('500')).toContain(5)
    expect(resultMap.get('500')).not.toContain(1)

    // Chat 600: Supergroup -> Folder 2 (Groups)
    expect(resultMap.get('600')).toContain(2)
  })

  it('handles empty folders list by clearing all folders', async () => {
    const db = await setupDb()
    const [account] = await db.insert(accountsTable).values({
      platform: 'telegram',
      platform_user_id: 'test-user-2',
    }).returning()

    const [chat] = await db.insert(joinedChatsTable).values({
      platform: 'telegram',
      chat_id: '999',
      chat_name: 'Test Chat',
      chat_type: 'user',
      dialog_date: Date.now(),
    }).returning()

    await db.insert(accountJoinedChatsTable).values({
      account_id: account.id,
      joined_chat_id: chat.id,
      folder_ids: [1, 2], // existing folders
    })

    await chatFolderModels.updateChatFolders(db, account.id, [])

    const result = await db
      .select({ folder_ids: accountJoinedChatsTable.folder_ids })
      .from(accountJoinedChatsTable)
      .where(
        and(
          eq(accountJoinedChatsTable.account_id, account.id),
          eq(accountJoinedChatsTable.joined_chat_id, chat.id),
        ),
      )

    // Now it should be empty because we iterate over ALL account chats and set folder_ids to [] if not matching
    expect(result[0].folder_ids).toEqual([])
  })
})
