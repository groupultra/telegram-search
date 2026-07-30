import type { TelegramApplication } from '../application/runtime'

import { createContext, defineInvokes, defineStreamInvoke } from '@moeru/eventa'
import { chatContracts, exportContracts } from '@tg-search/protocol'
import { describe, expect, it, vi } from 'vitest'

import { registerApplicationHandlers } from './index'

function fakeApplication(overrides: Partial<TelegramApplication> = {}): TelegramApplication {
  return {
    listChats: vi.fn(async () => ({ ok: true as const, data: { items: [], nextCursor: null } })),
    listRemoteMessages: vi.fn(),
    queryLocalMessages: vi.fn(),
    searchLocalMessages: vi.fn(),
    getLocalMessageContext: vi.fn(),
    getLocalStats: vi.fn(),
    exportLocal: vi.fn(),
    sync: vi.fn(),
    ...overrides,
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

  // Regression: browser runtimes omit exportLocal (see application/runtime.ts) to avoid
  // evaluating node:crypto/fs; the handler must not register when it is absent.
  it('does not register export handler when exportLocal is absent', async () => {
    const context = createContext()
    registerApplicationHandlers(context, fakeApplication({ exportLocal: undefined }))
    const reader = defineStreamInvoke(context, exportContracts.run)({
      outputDir: 'exports-fixture',
      format: 'jsonl',
      timeZone: 'UTC',
    }).getReader()

    // Unregistered Eventa streams stay pending instead of failing fast.
    const outcome = await Promise.race([
      reader.read().then(value => ({ kind: 'read' as const, value })),
      new Promise<{ kind: 'idle' }>((resolve) => {
        setTimeout(() => resolve({ kind: 'idle' }), 50)
      }),
    ])

    expect(outcome.kind).toBe('idle')
    await reader.cancel()
  })
})
