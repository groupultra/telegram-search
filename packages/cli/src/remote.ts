import type { AppResult, RemoteMethod } from '@tg-search/protocol'

import type { createCliRuntime } from './runtime'

import { normalizeRemoteUrl, parseRemoteResult } from '@tg-search/protocol'

export function createRemoteRuntime(endpoint: string, token: string): Awaited<ReturnType<typeof createCliRuntime>> & { remote: true } {
  const url = normalizeRemoteUrl(endpoint)
  if (!token || /\s/.test(token))
    throw new Error('Set TG_SEARCH_REMOTE_TOKEN to the server access token')
  const controller = new AbortController()

  async function invoke<Result>(method: RemoteMethod, input: unknown): Promise<AppResult<Result>> {
    const response = await fetch(`${url}/v1/remote/${method}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      redirect: 'error',
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)]),
    })
    if (!response.ok)
      throw new Error(`Remote request failed (HTTP ${response.status})`)
    return parseRemoteResult(method, await response.json()) as AppResult<Result>
  }

  function unsupported(): never {
    throw new Error('Remote mode supports read commands only; run sync or export on the server')
  }

  return {
    remote: true,
    invokes: {
      chats: { list: input => invoke('chats.list', input) },
      messages: {
        listRemote: input => invoke('messages.list', input),
        queryLocal: input => invoke('messages.query', input),
        searchLocal: input => invoke('messages.search', input),
        contextLocal: input => invoke('messages.context', input),
      },
      stats: { get: input => invoke('stats.get', input) },
    },
    streams: { sync: unsupported, export: unsupported },
    close: async () => controller.abort(),
  }
}
