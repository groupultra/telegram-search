import type { ReadOperationOptions } from '@tg-search/core'
import type { AppResult, CreateMediaLinkInput, MediaDownloadLink, RemoteMethod, RuntimeBuild } from '@tg-search/protocol'
import type { GenericSchema } from 'valibot'

import type { createCliRuntime } from './runtime'

import { ApplicationError, toAppError, withReadOperation } from '@tg-search/core'
import { normalizeRemoteUrl, remoteMethods, remoteResultSchema } from '@tg-search/protocol'
import { safeParse } from 'valibot'

import { runtimeBuildInfo } from './build-info'

type LocalRuntime = Awaited<ReturnType<typeof createCliRuntime>>
type RemoteRuntime = Omit<LocalRuntime, 'execution' | 'invokes'> & {
  remote: true
  execution: { mode: 'remote', cli: RuntimeBuild }
  invokes: LocalRuntime['invokes'] & {
    media: LocalRuntime['invokes']['media'] & {
      createLink: (input: CreateMediaLinkInput, options?: ReadOperationOptions) => Promise<AppResult<MediaDownloadLink & { url: string }>>
    }
  }
}

function protocolMismatch(): ApplicationError {
  return new ApplicationError({ code: 'REMOTE_PROTOCOL_MISMATCH', message: 'Remote server returned an invalid response', retryable: false })
}

export function createRemoteRuntime(endpoint: string, token: string): RemoteRuntime {
  const url = normalizeRemoteUrl(endpoint)
  if (!token || /\s/.test(token))
    throw new ApplicationError({ code: 'REMOTE_CREDENTIALS_MISSING', message: 'Set TG_SEARCH_REMOTE_TOKEN to the server access token', retryable: false })
  const controller = new AbortController()

  function invoke<Schema extends GenericSchema>(method: RemoteMethod, schema: Schema) {
    const resultSchema = remoteResultSchema(schema)
    return async (input: unknown, options?: ReadOperationOptions) => {
      try {
        const request = input as { operation?: { deadlineAt: number } }
        const deadlineAt = options?.deadlineAt ?? request.operation?.deadlineAt ?? Date.now() + 60_000
        const payload = options?.deadlineAt === undefined ? input : { ...request, operation: { ...request.operation, deadlineAt } }
        return await withReadOperation({ signal: options?.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal, deadlineAt }, async (scope) => {
          const response = await fetch(`${url}/v1/remote/${method}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
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
          const result = safeParse(resultSchema, await response.json())
          if (!result.success)
            throw protocolMismatch()
          return result.output
        })
      }
      catch (error) {
        if (error instanceof SyntaxError)
          return { ok: false as const, error: protocolMismatch().appError }
        return { ok: false as const, error: error instanceof TypeError ? { code: 'REMOTE_UNREACHABLE', message: 'Unable to reach the remote server', retryable: true } : toAppError(error) }
      }
    }
  }

  function unsupported(_input: unknown): never {
    throw new ApplicationError({ code: 'REMOTE_OPERATION_UNSUPPORTED', message: 'Remote mode supports read commands only; run sync or export on the server', retryable: false })
  }

  const createLink = invoke('media.createLink', remoteMethods['media.createLink'].output)

  return {
    remote: true as const,
    execution: { mode: 'remote' as const, cli: runtimeBuildInfo(import.meta.url) },
    invokes: {
      media: {
        read: invoke('media.read', remoteMethods['media.read'].output),
        async createLink(input: CreateMediaLinkInput, options?: ReadOperationOptions): Promise<AppResult<MediaDownloadLink & { url: string }>> {
          const result = await createLink(input, options)
          return result.ok ? { ...result, data: { ...result.data, url: `${url}${result.data.path}` } } : result
        },
      },
      chats: { list: invoke('chats.list', remoteMethods['chats.list'].output) },
      messages: {
        replies: invoke('messages.replies', remoteMethods['messages.replies'].output),
        read: invoke('messages.read', remoteMethods['messages.read'].output),
        get: invoke('messages.get', remoteMethods['messages.get'].output),
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
