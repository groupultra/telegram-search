// @vitest-environment node

import { useLogger } from '@guiiai/logg'
import { generateDefaultConfig } from '@tg-search/common'
import { CoreEventType, destroyCoreInstance } from '@tg-search/core'
import { plugin as wsPlugin } from 'crossws/server'
import { H3, serve } from 'h3'
import { expect, it } from 'vitest'

import { accountStates } from './account'
import { setupWsRoutes, updateAccountState } from './app'

it('answers heartbeats over a real WebSocket and retains the account across reconnects', async () => {
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
  const url = new URL('/ws?sessionId=recovery-test', server.url)
  url.protocol = 'ws:'
  const sockets: WebSocket[] = []

  function nextMessage(socket: WebSocket) {
    return new Promise<string>((resolve, reject) => {
      socket.addEventListener('message', event => resolve(String(event.data)), { once: true })
      socket.addEventListener('error', reject, { once: true })
    })
  }

  async function connect() {
    const socket = new WebSocket(url)
    sockets.push(socket)
    const handshake = JSON.parse(await nextMessage(socket))
    expect(handshake).toEqual({ type: 'server:connected', data: { sessionId: 'recovery-test', accountReady: false } })
    return socket
  }

  try {
    const first = await connect()
    const account = accountStates.get('recovery-test')!
    const pong = nextMessage(first)
    first.send('{"type":"server:ping"}')
    expect(await pong).toBe('{"type":"server:pong"}')
    const closed = new Promise(resolve => first.addEventListener('close', resolve, { once: true }))
    first.close()
    await closed
    const second = await connect()
    expect(accountStates.get('recovery-test')).toBe(account)
    const nextPong = nextMessage(second)
    second.send('{"type":"server:ping"}')
    expect(await nextPong).toBe('{"type":"server:pong"}')
    const readyListeners = account.ctx.emitter.listenerCount(CoreEventType.AccountReady)
    for (let attempt = 0; attempt < 20; attempt++)
      await updateAccountState(useLogger(), account, 'recovery-test', CoreEventType.AuthLogin)
    expect(account.ctx.emitter.listenerCount(CoreEventType.AccountReady)).toBe(readyListeners)
  }
  finally {
    for (const socket of sockets)
      socket.close()
    await server.close()
    const account = accountStates.get('recovery-test')
    if (account)
      await destroyCoreInstance(account.ctx)
    accountStates.delete('recovery-test')
  }
})
