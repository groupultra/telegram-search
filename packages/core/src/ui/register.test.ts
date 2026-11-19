import type { Models } from '../models'

import { useLogger } from '@guiiai/logg'
import { createContext } from '@moeru/eventa'
import { describe, expect, it, vi } from 'vitest'

import { getMockEmptyDB } from '../../mock'
import { createCoreContext } from '../context'
import { CoreEventType } from '../types/events'
import { uiCommandContracts, uiCoreNotificationTypes, uiNotificationContracts } from './contracts'
import { registerUiHandlers } from './register'

const logger = useLogger()

function setup() {
  const core = createCoreContext(getMockEmptyDB, {} as Models, logger)
  const eventa = createContext()
  return { core, eventa }
}

describe('registerUiHandlers', () => {
  it('forwards validated commands and drops invalid ones', async () => {
    const { core, eventa } = setup()
    const onSend = vi.fn()
    core.emitter.on(CoreEventType.MessageSend, onSend)
    registerUiHandlers(eventa, core)

    await eventa.emit(uiCommandContracts[CoreEventType.MessageSend].eventa, { chatId: '1', content: 'hi', accountId: 'x' } as never)
    await eventa.emit(uiCommandContracts[CoreEventType.MessageSend].eventa, { chatId: 1 } as never)
    await vi.waitFor(() => expect(onSend).toHaveBeenCalledOnce())
    expect(onSend).toHaveBeenCalledWith({ chatId: '1', content: 'hi' })
  })

  it('has no command for internal core events', () => {
    for (const internal of [
      CoreEventType.StorageRecordDialogs,
      CoreEventType.StorageRecordChatFolders,
      CoreEventType.StorageRecordMessages,
      CoreEventType.MessageProcess,
      CoreEventType.EntityProcess,
      CoreEventType.AccountReady,
      CoreEventType.CoreCleanup,
      CoreEventType.SyncReset,
      CoreEventType.BotSendMessage,
    ]) {
      expect(Object.keys(uiCommandContracts), internal).not.toContain(internal)
    }
  })

  it('forwards listed notifications until disposed', async () => {
    const { core, eventa } = setup()
    const received = vi.fn()
    eventa.on(uiNotificationContracts[CoreEventType.SyncStatus], ({ body }) => received(body))
    const dispose = registerUiHandlers(eventa, core)

    core.emitter.emit(CoreEventType.SyncStatus, { status: 'syncing' })
    await vi.waitFor(() => expect(received).toHaveBeenCalledWith({ status: 'syncing' }))

    dispose()
    core.emitter.emit(CoreEventType.SyncStatus, { status: 'idle' })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(received).toHaveBeenCalledOnce()
    expect(uiCoreNotificationTypes).not.toContain(CoreEventType.StorageRecordMessages)
  })
})
