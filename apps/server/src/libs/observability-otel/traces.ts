import { SpanStatusCode, trace } from '@opentelemetry/api'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'

const tracer = trace.getTracer('websocket-server')

export async function withSpan<T>(
  spanName: string,
  tracingId: string | undefined,
  fn: () => Promise<T> | T,
): Promise<T> {
  return tracer.startActiveSpan(spanName, async (span) => {
    // Prefer caller-supplied tracingId; fall back to this span's traceId
    const traceId = tracingId ?? span.spanContext().traceId
    span.setAttribute('tg.tracing_id', traceId)

    try {
      return await fn()
    }
    catch (error) {
      span.recordException(error as Error)
      span.setStatus({ code: SpanStatusCode.ERROR })
      console.error(error)
      throw error
    }
    finally {
      span.end()
    }
  })
}

const provider = new NodeTracerProvider({
  spanProcessors: [
    new SimpleSpanProcessor(new OTLPTraceExporter()),
  ],
})

provider.register()
