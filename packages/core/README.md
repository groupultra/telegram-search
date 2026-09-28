# @tg-search/core

Telegram Search domain services, persistence models, and application handlers.

`createTelegramApplicationRuntime()` composes direct business services. `registerApplicationHandlers()` exposes validated unary and streaming Eventa contracts without making the internal database and Telegram orchestration event-driven.

Remote message reads do not persist. Structured forward, media, and link metadata is stored only through explicit synchronization paths.

The connection service also supports Telegram QR login through `AuthLogin` with a `qrAttemptId`. `AuthQrCode` delivers short-lived tokens; `AuthQrState` reports password prompts and terminal failures. Password submissions and cancellation are scoped to the attempt ID. The service handles token expiration, DC migration, two-factor authentication, cancellation, and a five-minute attempt limit before publishing the normal session and connected events.
