# @tg-search/core

Telegram Search domain services, persistence models, and application handlers.

`createTelegramApplicationRuntime()` composes direct business services. `registerApplicationHandlers()` exposes validated unary and streaming Eventa contracts without making the internal database and Telegram orchestration event-driven.

Remote message reads do not persist. Structured forward, media, and link metadata is stored only through explicit synchronization paths.
