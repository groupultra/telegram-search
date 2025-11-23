import type { CoreDB } from '../../db'

import { beforeEach, describe, expect, it } from 'vitest'

import { setDbInstanceForTests } from '../../db'
import { mockDB } from '../../db/mock'
import { chatMessageStatsView } from '../../schemas/chat-message-stats'
import { chatMessagesTable } from '../../schemas/chat-messages'
import { joinedChatsTable } from '../../schemas/joined-chats'
import { usersTable } from '../../schemas/users'
import { getChatMessagesStats, getChatMessageStatsByChatId } from '../chat-message-stats'

describe('chat-message-stats model', () => {
  let db: CoreDB

  beforeEach(async () => {
    db = await mockDB({
      joinedChatsTable,
      chatMessagesTable,
      usersTable,
      chatMessageStatsView,
    })
    setDbInstanceForTests(db)
  })

  it('getChatMessagesStats should select all telegram stats', async () => {
    await db.insert(joinedChatsTable).values([
      {
        platform: 'telegram',
        chat_id: '1001',
        chat_name: 'Chat 1',
        chat_type: 'user',
        dialog_date: 0,
      },
      {
        platform: 'telegram',
        chat_id: '1002',
        chat_name: 'Chat 2',
        chat_type: 'user',
        dialog_date: 0,
      },
    ])

    await db.insert(chatMessagesTable).values([
      {
        platform: 'telegram',
        platform_message_id: '1',
        from_id: 'user-1',
        from_name: 'User 1',
        in_chat_id: '1001',
        content: 'Hello 1',
      },
      {
        platform: 'telegram',
        platform_message_id: '2',
        from_id: 'user-1',
        from_name: 'User 1',
        in_chat_id: '1001',
        content: 'Hello 2',
      },
      {
        platform: 'telegram',
        platform_message_id: '3',
        from_id: 'user-2',
        from_name: 'User 2',
        in_chat_id: '1002',
        content: 'Hi',
      },
    ])

    const result = await getChatMessagesStats()
    const rows = result.unwrap()

    const simplified = rows
      .map(row => ({
        chat_id: row.chat_id,
        message_count: row.message_count,
      }))
      .sort((a, b) => a.chat_id.localeCompare(b.chat_id))

    expect(simplified).toEqual([
      { chat_id: '1001', message_count: 2 },
      { chat_id: '1002', message_count: 1 },
    ])
  })

  it('getChatMessageStatsByChatId should return first stat row for a chat', async () => {
    await db.insert(joinedChatsTable).values([
      {
        platform: 'telegram',
        chat_id: '1001',
        chat_name: 'Chat 1',
        chat_type: 'user',
        dialog_date: 0,
      },
    ])

    await db.insert(chatMessagesTable).values([
      {
        platform: 'telegram',
        platform_message_id: '1',
        from_id: 'user-1',
        from_name: 'User 1',
        in_chat_id: '1001',
        content: 'Hello 1',
      },
      {
        platform: 'telegram',
        platform_message_id: '2',
        from_id: 'user-1',
        from_name: 'User 1',
        in_chat_id: '1001',
        content: 'Hello 2',
      },
    ])

    const resultOk = await getChatMessageStatsByChatId('1001')
    const row = resultOk.unwrap()

    expect(row.chat_id).toBe('1001')
    expect(row.message_count).toBe(2)
  })
})
