import { describe, expect, it } from 'vitest'
import { parse } from 'valibot'

import { chatContracts, listChatsInputSchema } from './chats'
import { listRemoteMessagesInputSchema, messageContracts } from './messages'

describe('application contracts', () => {
  it('rejects an empty remote chat id', () => {
    expect(() => parse(listRemoteMessagesInputSchema, {
      chatId: '',
      limit: 100,
    })).toThrow()
  })

  it('normalizes default chat pagination', () => {
    expect(parse(listChatsInputSchema, {})).toEqual({ limit: 100 })
  })

  it('uses stable versioned tags', () => {
    expect(chatContracts.list.sendEvent.id).toContain('tg.v1.chats.list')
    expect(messageContracts.listRemote.sendEvent.id).toContain('tg.v1.messages.list.remote')
  })
})
