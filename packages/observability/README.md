# Observability

Shared OpenTelemetry traces, metrics, and logs for Telegram Search. Node services
initialize automatic instrumentation with `registerOtel` from
`@tg-search/observability/node`; OTLP exporters use the standard
`OTEL_EXPORTER_OTLP_ENDPOINT` configuration.

## HTTP credentials

Incoming HTTP spans and outgoing `node:http` and native `fetch`/Undici spans
replace every `ticket` query value with `REDACTED`, including repeated or encoded parameter names. The HTTP
instrumentation's default sensitive query parameters remain redacted. Paths,
status codes, and unrelated query parameters remain observable; requests retain
their original URLs.

Temporary media tickets grant access to private content. Never write raw tickets
or complete download URLs to application logs, custom span attributes, or error
messages. Automatic HTTP redaction does not sanitize those manual fields.

## Verification

Run `pnpm -F @tg-search/observability exec vitest run src/http-redaction.test.ts`.
The regression includes real localhost `node:http` and native `fetch` client and
server spans with an in-memory exporter; it sends no telemetry to an external collector.
