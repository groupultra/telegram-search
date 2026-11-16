import type { RemoteAuthenticator, RemoteExecutor } from './executor'
import type { RemoteMediaLinks } from './media-links'

import { randomUUID } from 'node:crypto'

import { assertBodySize, H3, HTTPError, readBody, setResponseHeader } from 'h3'

import { RemoteInputError } from './executor'

function errorResponse(code: string, message: string, status: number, requestId: string): Response {
  return Response.json({ ok: false, error: { code, message, retryable: false } }, { status, headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId } })
}

/** REST transport for remote methods: `POST /:method` with a bearer access token. */
export function createRemoteApi(authenticate: RemoteAuthenticator, executor: RemoteExecutor, media: RemoteMediaLinks): H3 {
  const app = new H3()
  app.get('/media.download', event => media.download(event))
  app.head('/media.download', event => media.download(event))
  app.post('/:method', async (event) => {
    const authentication = await authenticate(event.req)
    if ('response' in authentication)
      return authentication.response

    const requestId = randomUUID()
    setResponseHeader(event, 'X-Request-Id', requestId)
    try {
      const execution = await executor.execute(authentication.principal, event.context.params?.method ?? '', {
        requestId,
        signal: event.req.signal,
        userAgent: event.req.headers.get('user-agent') ?? undefined,
        readInput: async () => {
          if (!event.req.headers.get('content-type')?.startsWith('application/json'))
            throw new RemoteInputError('UNSUPPORTED_MEDIA_TYPE', 415)
          assertBodySize(event, 65_536)
          return await readBody(event)
        },
      })
      if (execution.kind === 'result')
        return Response.json(execution.result, { headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId } })
      if (execution.status === 404 || execution.status === 415)
        return new Response(null, { status: execution.status, headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId } })
      return errorResponse(execution.code, execution.message, execution.status, requestId)
    }
    catch (error) {
      throw new HTTPError(error instanceof Error ? error.message : 'Remote request failed', {
        status: error instanceof HTTPError ? error.status : 500,
        cause: error,
        headers: { 'X-Request-Id': requestId },
        unhandled: true,
      })
    }
  })
  return app
}
