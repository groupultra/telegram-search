// @vitest-environment node

import { generateDefaultConfig } from '@tg-search/common'
import { CoreEventType, destroyCoreInstance, UI_HEARTBEAT_PING, UI_HEARTBEAT_PONG, uiCommandContracts, uiNotificationContracts } from '@tg-search/core'
import { plugin as wsPlugin } from 'crossws/server'
import { H3, serve } from 'h3'
import { expect, it, vi } from 'vitest'

import { accountStates } from './account'
import { setupWsRoutes } from './app'

const SESSION_ID = 'ui-contracts-test'
let deliveryId = 0

function eventaFrame(id: string, body: unknown) {
  return JSON.stringify({ deliveryId: `test-${++deliveryId}`, hopsRemaining: 32, eventa: { id, type: 'event', body } })
}

it('reaches core only through validated UI contracts', async () => {
  const app = new H3()
  setupWsRoutes(app, generateDefaultConfig())
  const server = serve(app, {
    hostname: '127.0.0.1',
    port: 0,
    plugins: [
      // @ts-expect-error - crossws extends the response at runtime
      wsPlugin({ resolve: async request => (await app.fetch(request)).crossws }),
    ],
  })
  await server.ready()
  const url = new URL(`/ws?sessionId=${SESSION_ID}`, server.url)
  url.protocol = 'ws:'
  const socket = new WebSocket(url)
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

  function nextMessage() {
    return new Promise<string>((resolve, reject) => {
      socket.addEventListener('message', event => resolve(String(event.data)), { once: true })
      socket.addEventListener('error', reject, { once: true })
    })
  }

  try {
    // The first frame is the server:connected notification, as an Eventa frame.
    const connected = JSON.parse(await nextMessage())
    expect(connected.eventa).toMatchObject({
      id: uiNotificationContracts['server:connected'].id,
      body: { sessionId: SESSION_ID, accountReady: false },
    })

    const account = accountStates.get(SESSION_ID)!
    const recordDialogs = vi.fn()
    const messageRead = vi.fn()
    account.ctx.emitter.on(CoreEventType.StorageRecordDialogs, recordDialogs)
    account.ctx.emitter.on(CoreEventType.MessageRead, messageRead)

    const injected = { accountId: '', dialogs: [{ id: 42, name: 'x', type: 'group' }] }
    // Before the contracts, this legacy frame reached recordChats with a
    // client-chosen accountId, linking that account to the chat and
    // rewriting its chat_type. Now there is no legacy path at all.
    socket.send(JSON.stringify({ type: CoreEventType.StorageRecordDialogs, data: injected }))
    // An Eventa frame named after an internal core event has no contract.
    socket.send(eventaFrame(CoreEventType.StorageRecordDialogs, injected))
    socket.send(eventaFrame(`tg.ui.v1.command.${CoreEventType.StorageRecordDialogs}`, injected))
    // A listed command passes with unknown fields stripped; an invalid one is dropped.
    socket.send(eventaFrame(uiCommandContracts[CoreEventType.MessageRead].eventa.id, { chatId: '42', accountId: 'attacker-chosen' }))
    socket.send(eventaFrame(uiCommandContracts[CoreEventType.MessageRead].eventa.id, { chatId: 42 }))

    // The server handles frames in order, so the pong arrives after all of them.
    const pong = nextMessage()
    socket.send(UI_HEARTBEAT_PING)
    expect(await pong).toBe(UI_HEARTBEAT_PONG)

    expect(recordDialogs).not.toHaveBeenCalled()
    expect(messageRead).toHaveBeenCalledOnce()
    expect(messageRead).toHaveBeenCalledWith({ chatId: '42' })
  }
  finally {
    consoleError.mockRestore()
    socket.close()
    await server.close()
    const account = accountStates.get(SESSION_ID)
    if (account)
      await destroyCoreInstance(account.ctx)
    accountStates.delete(SESSION_ID)
  }
})

it('forwards listed core events to the client and stops after the peer leaves', async () => {
  const app = new H3()
  setupWsRoutes(app, generateDefaultConfig())
  const server = serve(app, {
    hostname: '127.0.0.1',
    port: 0,
    plugins: [
      // @ts-expect-error - crossws extends the response at runtime
      wsPlugin({ resolve: async request => (await app.fetch(request)).crossws }),
    ],
  })
  await server.ready()
  const url = new URL(`/ws?sessionId=${SESSION_ID}-push`, server.url)
  url.protocol = 'ws:'
  const socket = new WebSocket(url)
  const frames: string[] = []
  socket.addEventListener('message', event => frames.push(String(event.data)))

  try {
    await vi.waitFor(() => expect(frames).toHaveLength(1))
    const account = accountStates.get(`${SESSION_ID}-push`)!
    account.ctx.emitter.emit(CoreEventType.SyncStatus, { status: 'syncing', progress: 50 })
    // Core events without a notification contract stay on the server.
    account.ctx.emitter.emit(CoreEventType.BotStatus, { status: 'connected' })
    await vi.waitFor(() => expect(frames).toHaveLength(2))
    expect(JSON.parse(frames[1]).eventa).toMatchObject({
      id: uiNotificationContracts[CoreEventType.SyncStatus].id,
      body: { status: 'syncing', progress: 50 },
    })

    const closed = new Promise(resolve => socket.addEventListener('close', resolve, { once: true }))
    socket.close()
    await closed
    await vi.waitFor(() => expect(account.activePeers.size).toBe(0))
    // The peer's subscription is gone; emitting again must not throw or send.
    account.ctx.emitter.emit(CoreEventType.SyncStatus, { status: 'idle' })
    expect(frames).toHaveLength(2)
  }
  finally {
    await server.close()
    const account = accountStates.get(`${SESSION_ID}-push`)
    if (account)
      await destroyCoreInstance(account.ctx)
    accountStates.delete(`${SESSION_ID}-push`)
  }
})
