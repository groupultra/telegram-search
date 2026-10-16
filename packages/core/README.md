# @tg-search/core

Telegram Search domain services, persistence models, and application handlers.

`createTelegramApplicationRuntime()` composes direct business services. `registerApplicationHandlers()` exposes validated unary and streaming Eventa contracts without making the internal database and Telegram orchestration event-driven.

Remote message reads do not persist. Structured forward, media, and link metadata is stored only through explicit synchronization paths.

Message relationships use the canonical `MessageRecord` Valibot schema in `@tg-search/protocol`. Native reply peer/top/topic/quote, album and forwarding facts survive the application transports. Explicit sync persists the optional native relationship metadata; existing indexed messages have no invented metadata.

`getMessages({ source, chatId, messageIds })` reads at most 100 IDs, scoped by chat and active account. `source` must be `local` or `telegram`; missing indexed messages never trigger network reads. Unavailable/deleted/inaccessible IDs are reported as `missingIds` without guessing why Telegram omitted them.
