import type { TelegramApplication } from '../application/runtime'

import { createContext, defineInvokes } from '@moeru/eventa'
import { chatContracts } from '@tg-search/protocol'
import { describe, expect, it, vi } from 'vitest'

import { registerApplicationHandlers } from './index'

function fakeApplication(): TelegramApplication {
  return {
    listChats: vi.fn(async () => ({ ok: true as const, data: { items: [], nextCursor: null } })),
    listRemoteMessages: vi.fn(),
    queryLocalMessages: vi.fn(),
    searchLocalMessages: vi.fn(),
    getLocalMessageContext: vi.fn(),
    getLocalStats: vi.fn(),
    exportLocal: vi.fn(),
    sync: vi.fn(),
  }
}

describe('application invoke handlers', () => {
  it('exposes unary application methods through Eventa', async () => {
    const context = createContext()
    registerApplicationHandlers(context, fakeApplication())
    const invokes = defineInvokes(context, chatContracts)

    await expect(invokes.list({ limit: 10 })).resolves.toEqual({
      ok: true,
      data: { items: [], nextCursor: null },
    })
  })

  it('returns INVALID_ARGUMENT for an invalid runtime payload', async () => {
    const context = createContext()
    const application = fakeApplication()
    registerApplicationHandlers(context, application)
    const invokes = defineInvokes(context, chatContracts)

    const result = await invokes.list({ limit: 0 })

    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_ARGUMENT' } })
    expect(application.listChats).not.toHaveBeenCalled()
  })
})
