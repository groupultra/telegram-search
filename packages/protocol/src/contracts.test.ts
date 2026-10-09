import { parse } from 'valibot'
import { describe, expect, it } from 'vitest'

import { chatContracts, listChatsInputSchema } from './chats'
import { exportContracts } from './export'
import { listRemoteMessagesInputSchema, messageContracts } from './messages'
import { statsContracts } from './stats'
import { syncContracts } from './sync'

describe('application contracts', () => {
  it('rejects an empty remote chat id', () => {
    expect(() => parse(listRemoteMessagesInputSchema, {
      chatId: '',
      limit: 100,
    })).toThrow()
  })

  it('accepts only message IDs as remote message cursors', () => {
    // Regression: offset cursors such as "0" were silently coerced, hiding stale callers.
    expect(parse(listRemoteMessagesInputSchema, { chatId: '42', cursor: '1001' }).cursor).toBe('1001')
    expect(() => parse(listRemoteMessagesInputSchema, { chatId: '42', cursor: '0' })).toThrow()
    expect(() => parse(listRemoteMessagesInputSchema, { chatId: '42', cursor: 'next' })).toThrow()
  })

  it('normalizes default chat pagination', () => {
    expect(parse(listChatsInputSchema, {})).toEqual({ limit: 100 })
  })

  it('uses stable versioned tags', () => {
    expect(chatContracts.list.sendEvent.id).toContain('tg.v1.chats.list')
    expect(messageContracts.listRemote.sendEvent.id).toContain('tg.v1.messages.list.remote')
    expect(statsContracts.get.sendEvent.id).toContain('tg.v1.stats.get')
    expect(exportContracts.run.sendEvent.id).toContain('tg.v1.export.run')
    expect(syncContracts.run.sendEvent.id).toContain('tg.v1.sync.run')
    expect(statsContracts.get.sendEvent.id).not.toContain('.local')
    expect(exportContracts.run.sendEvent.id).not.toContain('.local')
  })
})
