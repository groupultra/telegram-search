# Eventa-first Core and Agent CLI Design

Date: 2026-07-12
Status: Approved design

## 1. Context

Telegram Search currently exposes much of `@tg-search/core` through paired request and response events over WebSocket. A client emits a `ToCoreEvent`, the server forwards the event name into the Core emitter, and the client waits for a matching `FromCoreEvent`, often correlated by `requestId`.

That design works for realtime notifications, but it makes ordinary commands and queries behave like manually implemented RPC. Callers must register listeners, correlate responses, clean up listeners, handle timeouts separately, and interpret global error events. It also exposes Core's internal event vocabulary as the frontend wire protocol.

The immediate product need is a local TypeScript CLI that an AI Agent can use to log in to Telegram, discover chats, read selected remote history, explicitly sync selected history into PGlite, query the local dataset, and export structured data for analysis. The CLI must not contain AI analysis logic. It should expose reliable data primitives similar to `lark-cli`, leaving selection and analysis decisions to the calling Agent.

The CLI creates an opportunity to establish one clear typed boundary shared by Web local mode, Web server mode, and local CLI mode.

## 2. Goals

- Replace manual request and response event pairs with typed Eventa RPC contracts.
- Use Eventa Stream RPC for synchronization and export progress.
- Keep interactive CLI login as a local bootstrap boundary so phone codes and 2FA secrets never cross Eventa.
- Use Eventa events only for asynchronous notifications and realtime updates.
- Keep Core business logic in ordinary services with explicit inputs, outputs, transactions, cancellation, and errors.
- Add a publishable TypeScript CLI package inside the monorepo.
- Let the Agent decide whether to read remotely, which chats to select, which time range to request, and whether to persist data.
- Keep remote reads free of implicit message persistence.
- Make `sync` the only command that persists Telegram messages into PGlite.
- Support named profiles with isolated session, configuration, database, and exports.
- Preserve text plus structured message metadata without downloading media binaries by default.
- Produce deterministic machine-readable output suitable for Agent invocation.

## 3. Non-goals

- Built-in monthly or annual AI summaries.
- Model provider configuration in the CLI.
- Knowledge graph construction.
- A general REST API or tRPC layer in the first version.
- MCP support in the first version.
- Background daemon mode.
- Automatic selection of chats to synchronize.
- Full media archive or binary download.
- Replacing the existing Web frontend.
- Maintaining both old and new request-response protocols after a vertical slice is migrated.

HTTP remains appropriate for health checks and binary media delivery. Those endpoints are not replaced by Eventa.

## 4. Architectural Decision

All cross-boundary TypeScript interactions use Eventa, with the interaction type made explicit:

- RPC for one request and one result.
- Stream RPC for long-running work with intermediate states.
- Event for unsolicited notification after a fact occurs.

Core service internals continue to use direct function calls. Database writes, Telegram requests, transactions, and resolver orchestration are not converted into asynchronous events merely for consistency.

```text
Web local mode ── in-process Eventa context ─┐
CLI ──────────── in-process Eventa context ──┼─ Core handlers ─ Core services ─ Telegram/PGlite
Web server mode ─ Eventa WebSocket context ──┘
                                                   │
                                                   └─ domain notifications ─ Eventa events
```

This creates one public contract system without making Eventa the business logic container.

## 5. Package Boundaries

### 5.1 `@tg-search/protocol`

Create a transport contract package with no dependency on Telegram clients, databases, Vue, Pinia, or H3.

It owns:

- Eventa RPC, Stream RPC, and event definitions.
- Valibot input and output schemas.
- Cursor and pagination types.
- Serializable application error types.
- Reusable result envelopes.

Suggested structure:

```text
packages/protocol/src/
  auth.ts
  chats.ts
  messages.ts
  sync.ts
  export.ts
  stats.ts
  pagination.ts
  errors.ts
  index.ts
```

Contract names use a stable versioned namespace such as `tg.v1.chats.list`. Versioning applies to the public contract name, not to internal service functions.

Every remote handler validates inputs with Valibot. TypeScript types alone are not considered validation because Eventa forwards runtime payloads unchanged.

### 5.2 `@tg-search/core`

Core owns business services and handler registration.

```text
packages/core/src/
  services/
  handlers/
    register-auth-handlers.ts
    register-chat-handlers.ts
    register-message-handlers.ts
    register-sync-handlers.ts
    register-export-handlers.ts
```

Handlers are intentionally thin:

1. Validate the contract input.
2. Resolve the account-scoped runtime.
3. Invoke one Core service method.
4. Map domain errors to serializable application errors.
5. Return or stream the contract output.

Core services remain independently testable without Eventa.

### 5.3 `@tg-search/cli`

Create a publishable workspace package with a `bin` entry named `tg-search`.

```text
packages/cli/src/
  index.ts
  runtime.ts
  profile.ts
  output.ts
  commands/
```

The CLI creates an in-process Eventa context, registers the same Core handlers used by other local runtimes, builds typed invokes, executes one command, closes Telegram and PGlite resources, and exits.

The CLI does not import Vue, Pinia, browser stores, or server WebSocket types.

### 5.4 Server and Web

Server mode creates an authenticated, account-scoped Eventa WebSocket context. A peer may invoke only handlers associated with its resolved account runtime. Invoke responses must never be broadcast to unrelated peers.

Web local mode uses an in-process Eventa context. Web server mode uses the native WebSocket adapter. Both modes consume the same `@tg-search/protocol` contracts and typed invoke functions.

The existing media HTTP routes and `/health` remain HTTP endpoints.

## 6. Contract Categories

### 6.1 RPC contracts

- `auth.status`
- `auth.logout`
- `chats.list`
- `messages.list.remote`
- `messages.query.local`
- `messages.search.local`
- `messages.context.local`
- `stats.get.local`

RPC returns one explicit result or one serializable application error.

### 6.2 Stream RPC contracts

- `messages.sync`
- `messages.export`

Stream outputs are discriminated unions. For example, sync emits `started`, `progress`, `checkpoint`, `completed`, or `failed`. A stream has one terminal state.

Upgrade Eventa from `1.0.0-alpha.11` to `1.0.0-beta.11` before introducing the new contracts. The beta release propagates an invoke `AbortSignal` through `sendEventAbort` to the handler's `AbortController`. Cancelling a stream or aborting its signal must therefore cancel the matching Core task without a separate cancellation RPC.

Interactive `tg-search auth login` runs only in the local CLI bootstrap layer and writes the resulting `StringSession` into the selected profile. Phone codes and 2FA passwords are read from the terminal and are never sent through Eventa, stdout, or logs. A shared auth contract should only be added when another runtime has a real consumer and a complete challenge lifecycle.

### 6.3 Event contracts

- `account.connected`
- `account.disconnected`
- `message.received`
- `message.edited`
- `message.deleted`
- `sync.state_changed`

Events describe facts that have already occurred. They are not used to request database reads or mutations.

## 7. CLI Command Surface

All commands accept `--profile <name>`. The default profile name is `default`.

```text
tg-search profile list
tg-search profile use <name>

tg-search auth login
tg-search auth status
tg-search auth logout

tg-search chats list
tg-search messages list
tg-search sync
tg-search messages query
tg-search search
tg-search context
tg-search stats
tg-search export
```

### 7.1 Remote discovery and reads

`chats list` and `messages list` connect to Telegram and return remote data. They do not persist chats, messages, search tokens, vectors, or media metadata into PGlite.

The Telegram session file may be refreshed as part of normal connection maintenance. This does not count as message persistence and must not cause domain records to be written.

`messages list` supports:

- One explicit chat identifier.
- `from` and `to` timestamps.
- Limit and cursor pagination.
- Text plus structured message metadata.

### 7.2 Explicit synchronization

`sync` is the only command that persists Telegram messages.

It requires one or more explicit `--chat` values or an explicit `--all` flag. Calling `sync` without either fails validation. This prevents an Agent from accidentally importing all available history.

Synchronization:

- Applies `from` and `to` bounds.
- Uses Takeout and split ranges where appropriate.
- Defaults to no media binary download.
- Commits one page transactionally.
- Writes a checkpoint only after the page commit succeeds.
- Resumes from a valid checkpoint after interruption.
- Uses idempotent upsert semantics.
- Streams progress to the caller.

### 7.3 Local operations

`messages query`, `search`, `context`, `stats`, and `export` operate only on the profile's local PGlite database and never connect to Telegram.

`search` reuses existing jieba and optional vector retrieval. Absence of embedding configuration must not prevent text search.

## 8. Profiles and Local Storage

Each named profile owns an isolated directory selected through the platform-appropriate user data location:

```text
telegram-search/profiles/<profile>/
  config.json
  session
  pglite/
  exports/
```

Profile isolation requirements:

- Session data is never shared across profiles.
- PGlite data is never shared across profiles.
- Export defaults resolve inside the active profile unless an explicit output path is provided.
- The session file is readable and writable only by the current user.
- Session contents, API credentials, and authentication challenges are redacted from logs and errors.
- Removing a profile is not included in the first version because it is destructive. Logout clears Telegram authorization but does not delete exported or synchronized data.

## 9. Message Fidelity and Schema Changes

The first version preserves:

- Account/profile identity.
- Chat ID, name, and type.
- Message ID.
- Sender ID and display name.
- Telegram timestamp.
- Text and caption.
- Reply relationship.
- Forward origin.
- Links.
- Media type, file name, MIME type, and Telegram reference where available.
- Edit and delete state.

It does not download or embed media binaries by default.

`CoreMessage` already models reply, forward, and media information, but the current `chat_messages` table does not persist all forward and media metadata. Extend `chat_messages` with three typed JSONB columns: `forward`, `media`, and `links`. `forward` stores one normalized forward-origin object, while `media` and `links` store normalized arrays. Empty values use an empty object or array consistently. This representation keeps the first migration bounded and supports round-trip export without requiring Telegram access.

Database migrations are generated with Drizzle Kit and are not written manually.

## 10. Output Contract

Command results go to stdout. Logs, prompts, warnings, and progress rendering go to stderr.

Normal JSON output uses a stable envelope:

```json
{
  "ok": true,
  "data": [],
  "next_cursor": null,
  "meta": {
    "profile": "personal",
    "source": "telegram"
  }
}
```

Large exports use JSONL files rather than a single stdout payload. A grouped annual export contains:

```text
manifest.json
2026-01.jsonl
2026-02.jsonl
...
```

The manifest records export schema version, profile identity without session secrets, selected chats, time range, message counts, creation time, and file checksums.

## 11. Error Model

All cross-boundary errors are serializable values:

```ts
interface AppError {
  code: string
  message: string
  retryable: boolean
  retryAfterSeconds?: number
  details?: Record<string, unknown>
}
```

Required stable codes include:

- `INVALID_ARGUMENT`
- `PROFILE_NOT_FOUND`
- `AUTH_REQUIRED`
- `AUTH_CHALLENGE_FAILED`
- `TELEGRAM_RATE_LIMITED`
- `TAKEOUT_DELAYED`
- `CURSOR_INVALID`
- `STORAGE_FAILED`
- `SYNC_PARTIAL`
- `CANCELLED`

Unknown exceptions are logged with redaction and converted to `INTERNAL_ERROR` without leaking credentials or raw Telegram session data.

## 12. Security and Runtime Isolation

- Remote Eventa inputs are untrusted and always validated.
- Server-side account identity is resolved from authenticated connection context, never accepted as an arbitrary payload field.
- Each account runtime owns its Telegram client, handlers, subscriptions, and cancellation scope.
- Disconnecting one peer does not destroy an account runtime required by another peer.
- Logging applies the repository's redaction utilities before serialization.
- Eventa payload size limits remain enforced. Large binary data and export files use HTTP or local file paths.
- Eventa is upgraded and pinned to `1.0.0-beta.11`. Contracts remain in a separate package and Core services remain transport-independent because the library is still pre-1.0 and adapter APIs may continue to change.

## 13. Migration Strategy

Migration proceeds by vertical slice. The repository does not keep permanent backward-compatibility guards.

1. Add `@tg-search/protocol`, application error types, and in-process Eventa runtime support.
2. Migrate `chats.list`; update both Web modes; delete its old request and response event pair.
3. Migrate remote and local message listing; delete the corresponding old pairs.
4. Migrate local search, context, and stats.
5. Keep interactive CLI login local and store only the resulting session in the selected profile.
6. Migrate sync and export to Stream RPC with cancellation and checkpoint events.
7. Add `@tg-search/cli` on the migrated contracts.
8. Migrate realtime notifications to Eventa events.
9. Remove the old public `ToCoreEvent` and `FromCoreEvent` bridge after all consumers move.
10. Review remaining internal EventEmitter uses. Keep true internal domain fan-out or migrate it to local Eventa events only where doing so removes an abstraction rather than adding one.

The CLI package should land only after the contracts needed by its first command set are available. It must not introduce a second ad hoc facade over unmigrated event pairs.

## 14. Testing Strategy

### Contract tests

- Validate all inputs and outputs with Valibot.
- Verify RPC, Stream RPC, and event names are unique and stable.
- Verify errors serialize and deserialize without losing retry metadata.

### Core service tests

- Test business services without Eventa.
- Cover pagination, time boundaries, split ranges, cancellation, rate limits, and checkpoint resumption.

### Handler tests

- Use in-process Eventa contexts.
- Verify validation, account scoping, error mapping, and terminal stream behavior.

### PGlite integration tests

- Run generated migrations against temporary PGlite.
- Verify message metadata round trips.
- Verify idempotent sync and checkpoint ordering.
- Verify search, context, stats, and export results.

### CLI tests

- Verify argument parsing, profile resolution, stdout/stderr separation, exit codes, and JSON envelopes.
- Verify remote `messages list` leaves local message counts unchanged.
- Verify `sync` persists only explicitly selected chats.
- Verify local commands do not initialize a Telegram connection.
- Verify profiles cannot observe each other's session or data.

### Optional live verification

An environment-gated smoke test may use a real Telegram account to prove login, remote read, explicit sync, local query, and export. Offline tests are not described as live end-to-end verification.

## 15. Acceptance Criteria

- Web local mode, Web server mode, and CLI use the same Eventa contracts for migrated capabilities.
- No migrated command or query uses paired request and response events or manual `requestId` correlation.
- Remote reads do not persist domain messages.
- Only explicit `sync` persists selected chats.
- Long operations report typed progress and support cancellation through Eventa's propagated `AbortSignal`.
- CLI local query and export work without Telegram connectivity.
- Named profiles isolate sessions and PGlite data.
- Structured reply, forward, link, and media metadata survives sync and export.
- No media binary is downloaded unless a future explicit capability enables it.
- Results are machine-readable and logs never contaminate stdout.
- Old request-response event pairs are removed as each vertical slice migrates.
- tRPC and a general REST API are not added in this effort.
