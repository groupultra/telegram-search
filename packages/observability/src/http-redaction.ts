import type { Attributes } from '@opentelemetry/api'
import type { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'

type AutoInstrumentationConfig = NonNullable<Parameters<typeof getNodeAutoInstrumentations>[0]>
type HttpInstrumentationConfig = NonNullable<AutoInstrumentationConfig['@opentelemetry/instrumentation-http']>
type UndiciInstrumentationConfig = NonNullable<AutoInstrumentationConfig['@opentelemetry/instrumentation-undici']>

// Preserve HTTP instrumentation's default sensitive keys when adding our capability.
const REDACTED_QUERY_PARAMS = ['sig', 'Signature', 'AWSAccessKeyId', 'X-Goog-Signature', 'ticket']
const sensitiveKeys = new Set(REDACTED_QUERY_PARAMS)

export function redactHttpUrl(value: string): string {
  const question = value.indexOf('?')
  const fragment = value.indexOf('#')
  if (question < 0 || (fragment >= 0 && fragment < question))
    return value
  const end = fragment < 0 ? value.length : fragment
  const query = value.slice(question + 1, end).split('&').map((part) => {
    const equals = part.indexOf('=')
    const rawName = equals < 0 ? part : part.slice(0, equals)
    // URLSearchParams handles encoded keys and malformed escapes without throwing.
    const name = new URLSearchParams(`${rawName}=`).keys().next().value
    return name !== undefined && sensitiveKeys.has(name) ? `${rawName}=REDACTED` : part
  }).join('&')
  return `${value.slice(0, question + 1)}${query}${value.slice(end)}`
}

function urlAttributes(fullUrl: string, target: string): Attributes {
  const redactedTarget = redactHttpUrl(target)
  const question = redactedTarget.indexOf('?')
  const fragment = redactedTarget.indexOf('#')
  const query = question < 0 || (fragment >= 0 && fragment < question)
    ? ''
    : redactedTarget.slice(question + 1, fragment < 0 ? undefined : fragment)
  const redactedUrl = redactHttpUrl(fullUrl)
  return { 'http.url': redactedUrl, 'http.target': redactedTarget, 'url.full': redactedUrl, 'url.query': query }
}

export function createHttpInstrumentationConfig(): HttpInstrumentationConfig {
  return {
    redactedQueryParams: [...REDACTED_QUERY_PARAMS],
    // HTTP 0.211 merges start-hook attributes last; response attributes do not rewrite URLs.
    // redactedQueryParams alone leaves incoming URLs and legacy outgoing http.target exposed.
    startIncomingSpanHook(request) {
      const target = request.url ?? '/'
      const protocol = 'encrypted' in request.socket && request.socket.encrypted ? 'https:' : 'http:'
      const fullUrl = /^https?:\/\//i.test(target) ? target : `${protocol}//${request.headers.host ?? 'localhost'}${target}`
      return urlAttributes(fullUrl, target)
    },
    startOutgoingSpanHook(request) {
      const target = request.path ?? '/'
      const headerHost = request.headers && 'host' in request.headers ? request.headers.host : undefined
      const host = String(request.hostname ?? request.host ?? headerHost ?? 'localhost')
      const port = request.port !== undefined && !host.includes(':') && String(request.port) !== '80' && String(request.port) !== '443' ? `:${request.port}` : ''
      const fullUrl = /^https?:\/\//i.test(target) ? target : `${request.protocol ?? 'http:'}//${host}${port}${target}`
      return urlAttributes(fullUrl, target)
    },
  }
}

export function createUndiciInstrumentationConfig(): UndiciInstrumentationConfig {
  return {
    // Undici 0.21 merges this hook after its default URLs; response handling retains these attributes.
    startSpanHook(request) {
      const fullUrl = new URL(request.path, request.origin).href
      return urlAttributes(fullUrl, request.path)
    },
  }
}
