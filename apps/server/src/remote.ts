import type { TelegramApplication } from '@tg-search/core'

import { createHash, timingSafeEqual } from 'node:crypto'

import { accountIdSchema, listChatsInputSchema, listRemoteMessagesInputSchema, messageContextInputSchema, queryLocalMessagesInputSchema, searchMessagesInputSchema, statsInputSchema } from '@tg-search/protocol'
import { assertBodySize, H3, HTTPError, readValidatedBody } from 'h3'
import { minLength, object, parse, pipe, regex, string } from 'valibot'

export interface RemoteAccess {
  token: string
  accountId: string
}

export function remoteAccessFromEnv(env: Record<string, string | undefined>): RemoteAccess | undefined {
  const token = env.TG_SEARCH_REMOTE_TOKEN
  const accountId = env.TG_SEARCH_REMOTE_ACCOUNT_ID
  if (token === undefined && accountId === undefined)
    return undefined
  return parse(object({
    token: pipe(string(), minLength(32, 'TG_SEARCH_REMOTE_TOKEN must contain at least 32 characters'), regex(/^\S+$/, 'TG_SEARCH_REMOTE_TOKEN must not contain whitespace')),
    accountId: accountIdSchema,
  }), { token, accountId })
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
    try {
      const application = getApplication(access.accountId)
      let result
      switch (event.context.params?.method) {
        case 'chats.list':
          result = await application.listChats(await readValidatedBody(event, listChatsInputSchema))
          break
        case 'messages.list':
          result = await application.listRemoteMessages(await readValidatedBody(event, listRemoteMessagesInputSchema))
          break
        case 'messages.query':
          result = await application.queryLocalMessages(await readValidatedBody(event, queryLocalMessagesInputSchema))
          break
        case 'messages.search':
          result = await application.searchLocalMessages(await readValidatedBody(event, searchMessagesInputSchema))
          break
        case 'messages.context':
          result = await application.getLocalMessageContext(await readValidatedBody(event, messageContextInputSchema))
          break
        case 'stats.get':
          result = await application.getLocalStats(await readValidatedBody(event, statsInputSchema))
          break
        default: return new Response(null, { status: 404 })
      }
      return Response.json(result, { headers: { 'Cache-Control': 'no-store' } })
    }
    catch (error) {
      if (error instanceof HTTPError && error.status === 400)
        return Response.json({ ok: false, error: { code: 'INVALID_ARGUMENT', message: 'Invalid request parameters', retryable: false } }, { status: 400 })
      throw error
    }
  })
  return app
}
