import type { Hooks } from 'crossws'

import { useLogger } from '@guiiai/logg'
import { generateDefaultConfig } from '@tg-search/common'
import { CoreEventType, createCoreContext, models } from '@tg-search/core'
import { plugin as wsPlugin } from 'crossws/server'
import { H3, serve } from 'h3'
import { expect, it, vi } from 'vitest'

import { accountStates } from './account'
import { setupWsRoutes } from './app'

it('keeps QR events on the initiating WebSocket and cancels its attempt on disconnect', async () => {
  const accountId = crypto.randomUUID()
  const ctx = createCoreContext(() => {
    throw new Error('Unexpected database access')
  }, models, useLogger('test:qr-websocket'))
  accountStates.set(accountId, {
    ctx,
    accountReady: false,
    activePeers: new Set(),
    coreEventListeners: new Map(),
    createdAt: Date.now(),
    lastActive: Date.now(),
  })
  const logins = vi.fn()
  const cancellations = vi.fn()
  const passwords = vi.fn()
  ctx.emitter.on(CoreEventType.AuthLogin, logins)
  ctx.emitter.on(CoreEventType.AuthQrCancel, cancellations)
  ctx.emitter.on(CoreEventType.AuthQrPassword, passwords)
  const app = new H3()
  setupWsRoutes(app, generateDefaultConfig())
  const server = serve(app, {
    port: 0,
    hostname: '127.0.0.1',
    plugins: [wsPlugin({ resolve: async request => (await app.fetch(request) as Response & { crossws: Hooks }).crossws })],
  })
  const sockets: WebSocket[] = []
  const messages: Array<Array<{ type: string, data?: unknown }>> = []

  try {
    await server.ready()
    if (!server.url)
      throw new Error('Test server did not bind')
    const url = new URL(`/ws?sessionId=${accountId}`, server.url)
    url.protocol = 'ws:'
    for (let index = 0; index < 2; index++) {
      const socket = new WebSocket(url)
      const received: Array<{ type: string, data?: unknown }> = []
      socket.addEventListener('message', event => received.push(JSON.parse(String(event.data))))
      sockets.push(socket)
      messages.push(received)
      await vi.waitFor(() => expect(socket.readyState).toBe(WebSocket.OPEN))
      socket.send(JSON.stringify({ type: 'server:event:register', data: { event: CoreEventType.AuthQrCode } }))
      socket.send(JSON.stringify({ type: 'server:event:register', data: { event: CoreEventType.AuthQrState } }))
      socket.send(JSON.stringify({ type: CoreEventType.AuthLogin, data: { qrAttemptId: `attempt-${index}` } }))
    }
    await vi.waitFor(() => expect(logins).toHaveBeenCalledTimes(2))

    ctx.emitter.emit(CoreEventType.AuthQrCode, { attemptId: 'attempt-0', url: 'tg://login?token=test', expires: 100 })
    ctx.emitter.emit(CoreEventType.AuthQrState, { attemptId: 'attempt-1', status: 'error' })
    await vi.waitFor(() => {
      expect(messages[0]!.filter(message => message.type.startsWith('auth:qr:'))).toEqual([
        { type: CoreEventType.AuthQrCode, data: { attemptId: 'attempt-0', url: 'tg://login?token=test', expires: 100 } },
      ])
      expect(messages[1]!.filter(message => message.type.startsWith('auth:qr:'))).toEqual([
        { type: CoreEventType.AuthQrState, data: { attemptId: 'attempt-1', status: 'error' } },
      ])
    })

    const input = 'test-value'
    sockets[1]!.send(JSON.stringify({ type: CoreEventType.AuthQrPassword, data: { attemptId: 'attempt-0', password: input } }))
    sockets[1]!.send(JSON.stringify({ type: CoreEventType.AuthQrCancel, data: { attemptId: 'attempt-0' } }))
    sockets[1]!.send(JSON.stringify({ type: CoreEventType.AuthQrPassword, data: { attemptId: 'attempt-1', password: input } }))
    await vi.waitFor(() => expect(passwords).toHaveBeenCalledOnce())
    expect(passwords.mock.calls[0]![0]).toMatchObject({ attemptId: 'attempt-1', password: input })
    expect(cancellations).not.toHaveBeenCalled()
    sockets[0]!.close()
    await vi.waitFor(() => expect(cancellations).toHaveBeenCalledWith({ attemptId: 'attempt-0' }))
    expect(accountStates.has(accountId)).toBe(true)
  }
  finally {
    for (const socket of sockets)
      socket.close()
    await server.close(true)
    ctx.cleanup()
    accountStates.delete(accountId)
  }
})
