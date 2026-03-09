import { SpanStatusCode, trace } from '@opentelemetry/api'

export async function withSpan<T>(
  spanName: string,
  fn: () => Promise<T> | T,
  attributes?: Record<string, string | number | boolean>,
): Promise<T> {
  const tracer = trace.getTracer('@tg-search/observability')

  return tracer.startActiveSpan(spanName, async (span) => {
    if (attributes) {
      span.setAttributes(attributes)
    }

    try {
      return await fn()
    }
    catch (error) {
      span.recordException(error as Error)
      span.setStatus({ code: SpanStatusCode.ERROR })
      throw error
    }
    finally {
      span.end()
    }
  })
}
