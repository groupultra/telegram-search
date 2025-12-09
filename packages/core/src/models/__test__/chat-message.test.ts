import type { CoreMessage } from '../../types/message'

import { Ok } from '@unbird/result'
import { describe, expect, it, vi } from 'vitest'

import { setDbInstanceForTests } from '../../db'
import { chatMessagesTable } from '../../schemas/chat-messages'
import { joinedChatsTable } from '../../schemas/joined-chats'
import { recordMessages } from '../chat-message'

import * as photosModel from '../photos'
import * as stickersModel from '../stickers'

function createCoreMessage(overrides: Partial<CoreMessage>): CoreMessage {
  return {
    uuid: 'uuid-1',
    platform: 'telegram',
    platformMessageId: '1',
    chatId: '1001',
    fromId: '10',
    fromName: 'User 10',
    fromUserUuid: undefined,
    content: 'hello',
    media: [],
    reply: {
      isReply: false,
    },
    forward: {
      isForward: false,
    },
    platformTimestamp: Date.now(),
    ...overrides,
  }
}

vi.spyOn(photosModel, 'recordPhotos').mockImplementation(async () => Ok([]))
vi.spyOn(stickersModel, 'recordStickers').mockImplementation(async () => Ok([]))

describe('chat-message model with account-aware ownership', () => {
  it('recordMessages should set owner_account_id only for private chats', async () => {
    const messages: CoreMessage[] = [
      createCoreMessage({ chatId: '1001' }), // user chat
      createCoreMessage({ chatId: '2001', platformMessageId: '2' }), // group chat
    ]

    const chatRows = [
      { chat_id: '1001', chat_type: 'user' as const },
      { chat_id: '2001', chat_type: 'group' as const },
    ]

    const where = vi.fn(() => chatRows)
    const from = vi.fn(() => ({ where }))
    const select = vi.fn(() => ({ from }))

    const onConflictDoUpdate = vi.fn(() => ({
      returning: vi.fn(async () => []),
    }))
    const values = vi.fn(() => ({
      onConflictDoUpdate,
    }))
    const insert = vi.fn((table: unknown) => {
      if (table === chatMessagesTable) {
        return {
          values,
          onConflictDoUpdate,
        }
      }
      throw new Error('Unexpected table')
    })

    const fakeDb = {
      select,
      insert,
    }

    setDbInstanceForTests(fakeDb)

    await recordMessages('account-1', messages)

    expect(select).toHaveBeenCalledWith({
      chat_id: joinedChatsTable.chat_id,
      chat_type: joinedChatsTable.chat_type,
    })
    expect(from).toHaveBeenCalledWith(joinedChatsTable)
    expect(where).toHaveBeenCalled()

    expect(insert).toHaveBeenCalledWith(chatMessagesTable)
    expect(values).toHaveBeenCalled()

    const firstCall = values.mock.calls[0] as unknown as [Array<Record<string, unknown>>]
    const inserted = firstCall[0]
    expect(inserted.length).toBeGreaterThan(0)

    const privateRow = inserted.find(row => row.in_chat_id === '1001')
    const groupRow = inserted.find(row => row.in_chat_id === '2001')

    expect(privateRow?.owner_account_id).toBe('account-1')
    expect(groupRow?.owner_account_id).toBeUndefined()
  })
})
