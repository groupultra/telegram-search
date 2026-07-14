import type { TelegramApplication } from '../application/runtime'

import { createContext, defineStreamInvoke } from '@moeru/eventa'
import { syncContracts } from '@tg-search/protocol'
import { describe, expect, it, vi } from 'vitest'

import { registerApplicationHandlers } from './index'

function fakeApplication(sync: TelegramApplication['sync']): TelegramApplication {
  return {
    listChats: vi.fn(),
    listRemoteMessages: vi.fn(),
    queryLocalMessages: vi.fn(),
    searchLocalMessages: vi.fn(),
    getLocalMessageContext: vi.fn(),
    getLocalStats: vi.fn(),
    exportLocal: vi.fn(),
    sync,
  }
}

describe('stream application handlers', () => {
  it('propagates stream cancellation to the application signal', async () => {
    let receivedSignal: AbortSignal | undefined
    const application = fakeApplication(async function* (_input, signal) {
      receivedSignal = signal
      yield { type: 'started', taskId: 'task-1' }
      await new Promise(resolve => signal?.addEventListener('abort', resolve, { once: true }))
    })
    const context = createContext()
    registerApplicationHandlers(context, application)
    const stream = defineStreamInvoke(context, syncContracts.run)({ chatIds: ['chat-1'], all: false, limit: 100000, takeout: true })
    const reader = stream.getReader()

    await expect(reader.read()).resolves.toEqual({ done: false, value: { type: 'started', taskId: 'task-1' } })
    await reader.cancel()

    expect(receivedSignal?.aborted).toBe(true)
  })

  it('rejects an unscoped sync', async () => {
    const application = fakeApplication(vi.fn())
    const context = createContext()
    registerApplicationHandlers(context, application)
    const reader = defineStreamInvoke(context, syncContracts.run)({ chatIds: [], all: false, limit: 100000, takeout: false }).getReader()

    const update = await reader.read()

    expect(update.value).toMatchObject({ type: 'failed', error: { code: 'INVALID_ARGUMENT' } })
    expect(application.sync).not.toHaveBeenCalled()
  })

  it('rejects bulk sync without explicit takeout consent', async () => {
    const application = fakeApplication(vi.fn())
    const context = createContext()
    registerApplicationHandlers(context, application)
    const reader = defineStreamInvoke(context, syncContracts.run)({ chatIds: ['chat-1'], all: false, limit: 100000, takeout: false }).getReader()

    const update = await reader.read()

    expect(update.value).toMatchObject({ type: 'failed', error: { code: 'TAKEOUT_CONSENT_REQUIRED' } })
    expect(application.sync).not.toHaveBeenCalled()
  })
})
