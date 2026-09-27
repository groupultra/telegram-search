import type { RemoteMethod } from '@tg-search/protocol'
import type { GenericSchema } from 'valibot'

import type { createCliRuntime } from './runtime'

import { normalizeRemoteUrl, remoteMethods, remoteResultSchema } from '@tg-search/protocol'
import { parse, safeParse } from 'valibot'

export function createRemoteRuntime(endpoint: string, token: string): Awaited<ReturnType<typeof createCliRuntime>> & { remote: true } {
  const url = normalizeRemoteUrl(endpoint)
  if (!token || /\s/.test(token))
    throw new Error('Set TG_SEARCH_REMOTE_TOKEN to the server access token')
  const controller = new AbortController()

  function invoke<Schema extends GenericSchema>(method: RemoteMethod, schema: Schema) {
    const resultSchema = remoteResultSchema(schema)
    return async (input: unknown) => {
      const response = await fetch(`${url}/v1/remote/${method}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        redirect: 'error',
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)]),
      })
      if (!response.ok) {
        if (response.headers.get('content-type')?.split(';')[0].trim() === 'application/json') {
          const result = safeParse(resultSchema, await response.json())
          if (result.success && !result.output.ok)
            return result.output
        }
        throw new Error(`Remote request failed (HTTP ${response.status})`)
      }
      return parse(resultSchema, await response.json())
    }
  }

  function unsupported(): never {
    throw new Error('Remote mode supports read commands only; run sync or export on the server')
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
