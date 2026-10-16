# @tg-search/core

Telegram Search domain services, persistence models, and application handlers.

`createTelegramApplicationRuntime()` composes direct business services. `registerApplicationHandlers()` exposes validated unary and streaming Eventa contracts without making the internal database and Telegram orchestration event-driven.

Remote message reads do not persist. Structured forward, media, and link metadata is stored only through explicit synchronization paths.

Message relationships use the canonical `MessageRecord` Valibot schema in `@tg-search/protocol`. Native reply peer/top/topic/quote, album and forwarding facts survive the application transports. Explicit sync persists the optional native relationship metadata; existing indexed messages have no invented metadata.

`getMessages({ source, chatId, messageIds })` reads at most 100 IDs, scoped by chat and active account. `source` must be `local` or `telegram`; missing indexed messages never trigger network reads. Unavailable/deleted/inaccessible IDs are reported as `missingIds` without guessing why Telegram omitted them.

`getReplyContext` expands only reply links, defaults to one level and reports each root/link as resolved, missing, not requested, depth/node budget stopped, or cyclic. Node budget includes roots and unavailable point reads. Cross-chat references remain facts but need a separate explicit read, so a chat credential never implicitly grants another chat. Existing `getLocalMessageContext` is strictly a time-neighbor query.

`readMessages` reads a source-specific time window through bounded pages. It continues through empty pages with live cursors, deduplicates by `(chatId, messageId)`, and returns the final cursor, pages read and stop reason. Exhausting a window only describes pagination coverage; reply context and media content remain `not_requested`. Local offset reads reflect the current index rather than a transactional snapshot.
