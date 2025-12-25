import { SpanStatusCode, trace } from '@opentelemetry/api'

export async function withSpan<T>(
  spanName: string,
  fn: () => Promise<T> | T,
): Promise<T> {
  const tracer = trace.getTracer('@tg-search/observability')

  return tracer.startActiveSpan(spanName, async (span) => {
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
