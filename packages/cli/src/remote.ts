import type { ReadOperationOptions } from '@tg-search/core'
import type { RemoteMethod } from '@tg-search/protocol'
import type { GenericSchema } from 'valibot'

import type { createCliRuntime } from './runtime'

import { ApplicationError, toAppError, withReadOperation } from '@tg-search/core'
import { normalizeRemoteUrl, remoteMethods, remoteResultSchema } from '@tg-search/protocol'
import { parse, safeParse } from 'valibot'

export function createRemoteRuntime(endpoint: string, token: string): Awaited<ReturnType<typeof createCliRuntime>> & { remote: true } {
  const url = normalizeRemoteUrl(endpoint)
  if (!token || /\s/.test(token))
    throw new ApplicationError({ code: 'REMOTE_CREDENTIALS_MISSING', message: 'Set TG_SEARCH_REMOTE_TOKEN to the server access token', retryable: false })
  const controller = new AbortController()

  function invoke<Schema extends GenericSchema>(method: RemoteMethod, schema: Schema) {
    const resultSchema = remoteResultSchema(schema)
    return async (input: unknown, options?: ReadOperationOptions) => {
      try {
        return await withReadOperation({ signal: options?.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal, deadlineAt: (input as { operation?: { deadlineAt: number } }).operation?.deadlineAt ?? Date.now() + 60_000 }, async (scope) => {
          const response = await fetch(`${url}/v1/remote/${method}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
            redirect: 'error',
            signal: scope.signal,
          })
          if (!response.ok) {
            if (response.headers.get('content-type')?.split(';')[0].trim() === 'application/json') {
              const result = safeParse(resultSchema, await response.json())
              if (result.success && !result.output.ok)
                return result.output
            }
            throw new ApplicationError({ code: response.status === 401 ? 'REMOTE_AUTHENTICATION_FAILED' : response.status === 403 ? 'REMOTE_PERMISSION_DENIED' : response.status >= 500 ? 'REMOTE_UNAVAILABLE' : 'REMOTE_HTTP_ERROR', message: `Remote request failed (HTTP ${response.status})`, retryable: response.status >= 500 })
          }
          return parse(resultSchema, await response.json())
        })
      }
      catch (error) {
        return { ok: false as const, error: error instanceof TypeError ? { code: 'REMOTE_UNREACHABLE', message: 'Unable to reach the remote server', retryable: true } : toAppError(error) }
      }
    }
  }

  function unsupported(): never {
    throw new ApplicationError({ code: 'REMOTE_OPERATION_UNSUPPORTED', message: 'Remote mode supports read commands only; run sync or export on the server', retryable: false })
  }

  return {
    remote: true,
    invokes: {
      chats: { list: invoke('chats.list', remoteMethods['chats.list'].output) },
      messages: {
        listRemote: invoke('messages.list', remoteMethods['messages.list'].output),
        queryLocal: invoke('messages.query', remoteMethods['messages.query'].output),
        searchLocal: invoke('messages.search', remoteMethods['messages.search'].output),
        contextLocal: invoke('messages.context', remoteMethods['messages.context'].output),
      },
      stats: { get: invoke('stats.get', remoteMethods['stats.get'].output) },
    },
    streams: { sync: unsupported, export: unsupported },
    close: async () => controller.abort(),
  }
}
