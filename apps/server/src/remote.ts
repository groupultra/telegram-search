import type { TelegramApplication } from '@tg-search/core'

import { createHash, timingSafeEqual } from 'node:crypto'

import { listChatsInputSchema, listRemoteMessagesInputSchema, messageContextInputSchema, queryLocalMessagesInputSchema, searchMessagesInputSchema, statsInputSchema } from '@tg-search/protocol'
import { assertBodySize, H3 } from 'h3'
import { parse, ValiError } from 'valibot'

export interface RemoteAccess {
  token: string
  accountId: string
}

export function remoteAccessFromEnv(env: Record<string, string | undefined>): RemoteAccess | undefined {
  const token = env.TG_SEARCH_REMOTE_TOKEN
  const accountId = env.TG_SEARCH_REMOTE_ACCOUNT_ID
  if (token === undefined && accountId === undefined)
    return undefined
  if (!token || token.length < 32 || /\s/.test(token))
    throw new Error('TG_SEARCH_REMOTE_TOKEN must contain at least 32 characters without whitespace')
  if (!accountId || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(accountId))
    throw new Error('TG_SEARCH_REMOTE_ACCOUNT_ID must be a database account UUID')
  return { token, accountId }
}

export function createRemoteApi(access: RemoteAccess, getApplication: (accountId: string) => TelegramApplication): H3 {
  const expected = createHash('sha256').update(`Bearer ${access.token}`).digest()
  const app = new H3()
  app.post('/:method', async (event) => {
    const supplied = createHash('sha256').update(event.req.headers.get('authorization') ?? '').digest()
    if (!timingSafeEqual(expected, supplied))
      return new Response(null, { status: 401, headers: { 'WWW-Authenticate': 'Bearer', 'Cache-Control': 'no-store' } })
    if (!event.req.headers.get('content-type')?.startsWith('application/json'))
      return new Response(null, { status: 415 })
    assertBodySize(event, 65_536)
    const body = await event.req.text()
    try {
      const input: unknown = JSON.parse(body)
      const application = getApplication(access.accountId)
      let result
      switch (event.context.params?.method) {
        case 'chats.list':
          result = await application.listChats(parse(listChatsInputSchema, input))
          break
        case 'messages.list':
          result = await application.listRemoteMessages(parse(listRemoteMessagesInputSchema, input))
          break
        case 'messages.query':
          result = await application.queryLocalMessages(parse(queryLocalMessagesInputSchema, input))
          break
        case 'messages.search':
          result = await application.searchLocalMessages(parse(searchMessagesInputSchema, input))
          break
        case 'messages.context':
          result = await application.getLocalMessageContext(parse(messageContextInputSchema, input))
          break
        case 'stats.get':
          result = await application.getLocalStats(parse(statsInputSchema, input))
          break
        default: return new Response(null, { status: 404 })
      }
      return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
    }
    catch (error) {
      if (error instanceof SyntaxError || error instanceof ValiError)
        return Response.json({ ok: false, error: { code: 'INVALID_ARGUMENT', message: 'Invalid request parameters', retryable: false } }, { status: 400 })
      throw error
    }
  })
  return app
}
