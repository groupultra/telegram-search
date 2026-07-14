import type { TelegramApplicationRuntime } from '@tg-search/core'

import { describe, expect, it, vi } from 'vitest'

import { createLocalApplicationBridge } from './eventa-local'
import { createWebSocketApplicationBridge } from './eventa-websocket'

describe('eventa application adapters', () => {
  it('exposes the same application invoke surface in local and WebSocket modes', () => {
    const local = createLocalApplicationBridge(() => {
      throw new Error('not invoked')
    })
    const remote = createWebSocketApplicationBridge(() => undefined)
    const applicationKeys = [
      'listChats',
      'listRemoteMessages',
      'queryLocalMessages',
      'searchLocalMessages',
      'getLocalMessageContext',
      'getLocalStats',
    ]

    expect(applicationKeys.every(key => typeof local[key as keyof typeof local] === 'function')).toBe(true)
    expect(applicationKeys.every(key => typeof remote[key as keyof typeof remote] === 'function')).toBe(true)
  })

  it('does not replace handlers owned by the WebSocket client', async () => {
    class FakeSocket extends EventTarget {
      readyState = WebSocket.OPEN
      url = 'ws://telegram-search.test/ws'
      send = vi.fn()
      onmessage = vi.fn()
    }
    const socket = new FakeSocket()
    const originalOnMessage = socket.onmessage
    const bridge = createWebSocketApplicationBridge(() => socket as unknown as WebSocket)

    const pending = bridge.listChats({ limit: 1 })

    expect(socket.onmessage).toBe(originalOnMessage)
    expect(socket.send).toHaveBeenCalledOnce()
    await bridge.dispose?.()
    await expect(pending).rejects.toThrow()
  })

  it('rebinds the local runtime after an account context reset', async () => {
    const contexts = [{ account: 'one' }, { account: 'two' }]
    let contextIndex = 0
    const disposed: string[] = []
    const bridge = createLocalApplicationBridge(
      () => contexts[contextIndex] as never,
      {
        createRuntime: ({ context }) => ({
          listChats: vi.fn(async () => ({
            ok: true as const,
            data: { items: [{ id: (context as unknown as { account: string }).account, name: 'Account', type: 'user' as const }], nextCursor: null },
          })),
          listRemoteMessages: vi.fn(),
          queryLocalMessages: vi.fn(),
          searchLocalMessages: vi.fn(),
          getLocalMessageContext: vi.fn(),
          getLocalStats: vi.fn(),
          exportLocal: vi.fn(),
          sync: vi.fn(),
          dispose: vi.fn(async () => {
            disposed.push((context as unknown as { account: string }).account)
          }),
        } as unknown as TelegramApplicationRuntime),
      },
    )

    await expect(bridge.listChats({ limit: 1 })).resolves.toMatchObject({ data: { items: [{ id: 'one' }] } })
    contextIndex = 1
    await bridge.reset()
    await expect(bridge.listChats({ limit: 1 })).resolves.toMatchObject({ data: { items: [{ id: 'two' }] } })
    expect(disposed).toEqual(['one'])
    await bridge.dispose()
  })
})
