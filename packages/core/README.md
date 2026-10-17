# @tg-search/core

Telegram Search domain services, persistence models, and application handlers.

`createTelegramApplicationRuntime()` composes direct business services. `registerApplicationHandlers()` exposes validated unary and streaming Eventa contracts without making the internal database and Telegram orchestration event-driven.

Remote message reads do not persist. Structured forward, media, and link metadata is stored only through explicit synchronization paths.

Message relationships use the canonical `MessageRecord` Valibot schema in `@tg-search/protocol`. Native reply peer/top/topic/quote, album and forwarding facts survive the application transports. Explicit sync persists the optional native relationship metadata; existing indexed messages have no invented metadata.

`getMessages({ source, chatId, messageIds })` reads at most 100 IDs, scoped by chat and active account. `source` must be `local` or `telegram`; missing indexed messages never trigger network reads. Unavailable/deleted/inaccessible IDs are reported as `missingIds` without guessing why Telegram omitted them.

`getReplyContext` expands only reply links, defaults to one level and reports each root/link as resolved, missing, not requested, depth/node budget stopped, or cyclic. Node budget includes roots and unavailable point reads. Cross-chat references remain facts but need a separate explicit read, so selecting one chat never implicitly reads another chat. Existing `getLocalMessageContext` is strictly a time-neighbor query.

`readMessages` reads a source-specific time window through bounded pages. It continues through empty pages with live cursors, deduplicates by `(chatId, messageId)`, and returns the final cursor, pages read and stop reason. Exhausting a window only describes pagination coverage; reply context and media content remain `not_requested`. Local offset reads reflect the current index rather than a transactional snapshot.

### Bounded attachment content

The application exposes attachment reads by message identity and explicit source. Source resolvers validate the message before resolving its media; the shared reader enforces the attachment byte limit and emits bounded base64 chunks with a continuation offset. Stored media providers expose byte length and range reads, keeping storage locations opaque to clients. Content is not fetched by ordinary message listing and is never automatically interpreted.

`inspectMessageMedia(input, options)` returns a `MessageMediaDescriptor` containing the resolved `fileId`, type, byte size and optional MIME type/file name without downloading content. `downloadMessageMedia(input, options)` returns that descriptor plus raw `Uint8Array` bytes. These application methods support HTTP delivery without adding raw binary payloads to Eventa. Both use the same explicit source, account scope and attachment budget as `readMessageMedia`; local content never falls back to Telegram. Telegram photos report their photo ID and `image/jpeg`; Document attachments report their document ID and native MIME type.

A complete download resolves its source once and reads from zero to the declared size in ranges of at most 256 KiB, validating every range before returning bytes. The input's `offset` and `length` apply only to chunk reads; complete downloads always cover the whole file, including empty files. The protocol limits attachment budgets to 50 MiB. One read operation carries cancellation and an absolute deadline through resolution and every range; no partial content is returned as a successful complete download.

Export reply snapshots may resolve outside the requested time range, while retaining explicit chat selection and active-account authorization. A `replyTo: null` means the target is unavailable within that export scope; it does not assert that the message is absent from the database. Without a chat selection, reply lookups remain scoped to the active account.

Local pagination cursors are non-negative safe integer offsets. Invalid or precision-losing cursors fail with `INVALID_ARGUMENT`; they never restart a read at offset zero. Telegram cursors remain positive message IDs and are validated for exact numeric conversion.

Generated migration `0037_message-relationship-facts` adds nullable `chat_messages.telegram_metadata` to the existing message table. Existing rows remain unchanged until explicit synchronization provides native metadata.
