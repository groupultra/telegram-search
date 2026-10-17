import type { AddressInfo } from 'node:net'

import { createRequire } from 'node:module'

import { context, propagation, SpanKind, trace } from '@opentelemetry/api'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { InMemorySpanExporter, NodeTracerProvider, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node'
import { describe, expect, it, vi } from 'vitest'

import { createHttpInstrumentationConfig, createUndiciInstrumentationConfig, redactHttpUrl } from './http-redaction'

describe('hTTP credential query redaction', () => {
  it.each([
    ['/media?ticket=synthetic-first&view=full&ticket=synthetic-second', '/media?ticket=REDACTED&view=full&ticket=REDACTED'],
    ['https://example.test/media?%74icket=synthetic-first&download=1#section', 'https://example.test/media?%74icket=REDACTED&download=1#section'],
    ['/media?ticket=&ticket=synthetic-second', '/media?ticket=REDACTED&ticket=REDACTED'],
    ['/media?sig=a&Signature=b&AWSAccessKeyId=c&X-Goog-Signature=d&size=small', '/media?sig=REDACTED&Signature=REDACTED&AWSAccessKeyId=REDACTED&X-Goog-Signature=REDACTED&size=small'],
    ['/media?view=full&label=a%20b&label=c', '/media?view=full&label=a%20b&label=c'],
    ['/media#ticket=not-a-query', '/media#ticket=not-a-query'],
  ])('redacts credentials and preserves unrelated URL data (%s)', (url, expected) => {
    expect(redactHttpUrl(url)).toBe(expected)
  })

  it('exports real node:http and native fetch spans without tickets while preserving requests and statuses', async () => {
    // HTTP instrumentation's incoming URL attributes bypass its outgoing redactedQueryParams option.
    vi.stubEnv('OTEL_NODE_ENABLED_INSTRUMENTATIONS', 'http,undici')
    vi.stubEnv('OTEL_SEMCONV_STABILITY_OPT_IN', 'http/dup')
    const exporter = new InMemorySpanExporter()
    const provider = new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] })
    const instrumentations = getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': createHttpInstrumentationConfig(),
      '@opentelemetry/instrumentation-undici': createUndiciInstrumentationConfig(),
    })
    for (const instrumentation of instrumentations)
      instrumentation.setTracerProvider(provider)
    provider.register()
    // Require the built-in after instrumentation so its real CommonJS hooks are exercised.
    const http = createRequire(import.meta.url)('node:http') as typeof import('node:http')
    const path = '/v1/remote/media.download?ticket=synthetic-first&view=full&ticket=synthetic-second&%74icket=synthetic-encoded&sig=synthetic-signature'
    const redactedPath = '/v1/remote/media.download?ticket=REDACTED&view=full&ticket=REDACTED&%74icket=REDACTED&sig=REDACTED'
    let receivedUrl: string | undefined
    const server = http.createServer((request, response) => {
      receivedUrl = request.url
      response.statusCode = 206
      response.end('synthetic body')
    })
    try {
      await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
      const port = (server.address() as AddressInfo).port
      for (const client of ['node:http', 'fetch']) {
        if (client === 'fetch') {
          // Node fetch uses Undici rather than the node:http instrumentation.
          const response = await fetch(`http://127.0.0.1:${port}${path}`)
          expect(response.status).toBe(206)
          expect(await response.text()).toBe('synthetic body')
        }
        else {
          await new Promise<void>((resolve, reject) => {
            http.get({ hostname: '127.0.0.1', port, path }, (response) => {
              response.resume()
              response.once('end', resolve)
            }).once('error', reject)
          })
        }
        await provider.forceFlush()
        const spans = exporter.getFinishedSpans().filter(span => span.kind === SpanKind.CLIENT || span.kind === SpanKind.SERVER)
        expect(spans.map(span => span.kind).sort()).toEqual([SpanKind.SERVER, SpanKind.CLIENT].sort())
        expect(spans.find(span => span.kind === SpanKind.CLIENT)!.instrumentationScope.name).toBe(client === 'fetch' ? '@opentelemetry/instrumentation-undici' : '@opentelemetry/instrumentation-http')
        expect(receivedUrl).toBe(path)
        for (const span of spans) {
          const attributes = JSON.stringify(span.attributes)
          expect(attributes).not.toContain('synthetic-first')
          expect(attributes).not.toContain('synthetic-second')
          expect(attributes).not.toContain('synthetic-encoded')
          expect(attributes).not.toContain('synthetic-signature')
          expect(span.attributes['http.target']).toBe(redactedPath)
          expect(span.attributes['url.full']).toBe(`http://127.0.0.1:${port}${redactedPath}`)
          if (span.instrumentationScope.name === '@opentelemetry/instrumentation-http')
            expect(span.attributes['http.status_code']).toBe(206)
          else
            expect(span.attributes['url.path']).toBe('/v1/remote/media.download')
          expect(span.attributes['http.response.status_code']).toBe(206)
        }
        exporter.reset()
      }
    }
    finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
      for (const item of instrumentations)
        item.disable()
      await provider.shutdown()
      trace.disable()
      context.disable()
      propagation.disable()
      vi.unstubAllEnvs()
    }
  })
})
