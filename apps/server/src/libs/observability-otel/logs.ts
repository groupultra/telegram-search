import { trace } from '@opentelemetry/api'
import { logs, SeverityNumber } from '@opentelemetry/api-logs'

/**
 * Helper to emit a log to OpenTelemetry
 * This can be called manually from your code when you want to send logs to OTEL
 */
export function emitOtelLog(level: string, context: string, message: string, attributes?: Record<string, string | number | boolean>): void {
  const otelLogger = logs.getLogger(context)

  const span = trace.getActiveSpan()

  // Map log level to OpenTelemetry severity
  const getSeverity = (level: string): SeverityNumber => {
    switch (level.toLowerCase()) {
      case 'debug':
        return SeverityNumber.DEBUG
      case 'verbose':
        return SeverityNumber.TRACE
      case 'log':
      case 'info':
        return SeverityNumber.INFO
      case 'warn':
        return SeverityNumber.WARN
      case 'error':
        return SeverityNumber.ERROR
      default:
        return SeverityNumber.INFO
    }
  }

  const spanContext = span?.spanContext()
  const traceId = spanContext?.traceId
  const body = traceId ? `${message} [tracing_id: ${traceId}]` : message

  otelLogger.emit({
    severityNumber: getSeverity(level),
    severityText: level.toUpperCase(),
    body,
    attributes: {
      ...attributes,
      tracing_id: traceId,
      span_id: spanContext?.spanId,
    },
  })
}
