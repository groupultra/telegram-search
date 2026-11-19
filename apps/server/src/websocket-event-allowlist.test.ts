// @vitest-environment node

import { generateDefaultConfig } from '@tg-search/common'
import { CoreEventType, destroyCoreInstance } from '@tg-search/core'
import { plugin as wsPlugin } from 'crossws/server'
import { H3, serve } from 'h3'
import { expect, it, vi } from 'vitest'

import { accountStates } from './account'
import { setupWsRoutes } from './app'
import { isClientEmittableCoreEvent } from './events'

const SESSION_ID = 'event-allowlist-test'

it('keeps internal persistence and Telegram events out of client reach', () => {
  for (const type of [
    CoreEventType.StorageRecordDialogs,
    CoreEventType.StorageRecordChatFolders,
    CoreEventType.StorageRecordMessages,
    CoreEventType.MessageProcess,
    CoreEventType.AccountReady,
    CoreEventType.CoreCleanup,
    CoreEventType.GramMessageReceived,
    CoreEventType.SyncReset,
    'server:unknown',
    '__proto__',
  ]) {
    expect(isClientEmittableCoreEvent(type), type).toBe(false)
  }
  expect(isClientEmittableCoreEvent(CoreEventType.StorageSearchMessages)).toBe(true)
})

it('drops internal events sent over the WebSocket and forwards UI events', async () => {
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

  function nextMessage() {
    return new Promise<string>((resolve, reject) => {
      socket.addEventListener('message', event => resolve(String(event.data)), { once: true })
      socket.addEventListener('error', reject, { once: true })
    })
  }

  try {
    await nextMessage()
    const account = accountStates.get(SESSION_ID)!
    const recordDialogs = vi.fn()
    const messageRead = vi.fn()
    account.ctx.emitter.on(CoreEventType.StorageRecordDialogs, recordDialogs)
    account.ctx.emitter.on(CoreEventType.MessageRead, messageRead)

    // Before the allowlist, this frame reached recordChats with a client-chosen
    // accountId, linking that account to the chat and rewriting its chat_type.
    socket.send(JSON.stringify({
      type: CoreEventType.StorageRecordDialogs,
      data: { accountId: '', dialogs: [{ id: 42, name: 'x', type: 'group' }] },
    }))
    socket.send(JSON.stringify({ type: CoreEventType.MessageRead, data: { chatId: '42' } }))

    // The server handles frames in order, so the pong arrives after both.
    const pong = nextMessage()
    socket.send('{"type":"server:ping"}')
    expect(await pong).toBe('{"type":"server:pong"}')

    expect(recordDialogs).not.toHaveBeenCalled()
    expect(messageRead).toHaveBeenCalledWith(expect.objectContaining({ chatId: '42' }))
  }
  finally {
    socket.close()
    await server.close()
    const account = accountStates.get(SESSION_ID)
    if (account)
      await destroyCoreInstance(account.ctx)
    accountStates.delete(SESSION_ID)
  }
})
