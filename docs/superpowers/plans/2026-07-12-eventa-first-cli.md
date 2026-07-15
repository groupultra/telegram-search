# Eventa-first Core and Agent CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Telegram Search's public paired-event RPC with Eventa contracts and ship a publishable local `tg-search` CLI for Agent-controlled Telegram discovery, synchronization, local retrieval, and export.

**Architecture:** A new `@tg-search/protocol` package owns validated Eventa RPC, Stream RPC, and notification contracts. Core services remain ordinary TypeScript and are exposed through thin Eventa handlers; Web local mode and CLI use in-process contexts, while server mode uses account-scoped H3 WebSocket contexts. HTTP remains only for health and binary media.

**Tech Stack:** TypeScript 5.9, Node.js 24, pnpm 10, Eventa 1.0.0-beta.11, Valibot 1.4, GramJS 2.26, PGlite 0.3, Drizzle ORM 0.45, H3 2 RC, Vue 3, Pinia, Vitest 4, tsdown 0.20.

> **Implementation note:** interactive CLI login remains a local bootstrap operation. The auth Stream RPC and challenge steps below were superseded because they had no working shared runtime consumer; sync and export remain Stream RPCs.

## Global Constraints

- Upgrade and pin `@moeru/eventa` to `1.0.0-beta.11` before adding contracts.
- Validate every remote input with Valibot at the handler boundary.
- Use Eventa RPC for request-response, Stream RPC for long operations, and Eventa events for unsolicited notifications.
- Keep database transactions, Telegram calls, and Core orchestration as direct service calls.
- `messages list` is remote and does not persist domain data; only explicit `sync` persists messages.
- `sync` requires at least one `--chat` or explicit `--all`.
- Named profiles isolate config, session, PGlite, and exports; default profile is `default`.
- Do not download media binaries by default.
- stdout contains command results only; stderr contains prompts, logs, and progress.
- Do not add REST, tRPC, MCP, daemon mode, knowledge graphs, or AI summarization.
- Generate migrations with Drizzle Kit; do not hand-write SQL.
- Remove old request-response event pairs as each vertical slice migrates.
- Run `pnpm run typecheck` and `pnpm run lint:fix` after implementation.

---

## File Structure

### New packages

- `packages/protocol`: shared schemas, result types, Eventa contracts, and contract tests.
- `packages/cli`: profile storage, in-process runtime, command handlers, JSON/JSONL output, and CLI tests.

### Core additions

- `packages/core/src/application/runtime.ts`: constructs account-scoped services and owns cleanup.
- `packages/core/src/application/errors.ts`: maps unknown/domain errors into `AppError`.
- `packages/core/src/handlers/*.ts`: thin Eventa handler registration by capability.
- `packages/core/src/services/remote-messages.ts`: remote read without storage side effects.
- `packages/core/src/services/local-messages.ts`: local query/search/context/stats facade.
- `packages/core/src/services/export.ts`: deterministic JSONL export.

### Existing surfaces changed

- `apps/server/src/app.ts`: account-scoped Eventa peer contexts and realtime notifications.
- `packages/client/src/adapters/*`: Eventa local and native WebSocket contexts.
- `packages/client/src/stores/*`: invokes replace migrated request-response event pairs.
- `packages/core/src/schemas/chat-messages.ts`: structured `forward`, `media`, and `links` JSONB.
- `packages/core/src/models/utils/message.ts`: metadata round-trip conversion.

---

### Task 1: Upgrade Eventa and establish the protocol package

**Files:**
- Create: `packages/protocol/package.json`
- Create: `packages/protocol/tsconfig.json`
- Create: `packages/protocol/vitest.config.ts`
- Create: `packages/protocol/src/errors.ts`
- Create: `packages/protocol/src/pagination.ts`
- Create: `packages/protocol/src/chats.ts`
- Create: `packages/protocol/src/messages.ts`
- Create: `packages/protocol/src/index.ts`
- Test: `packages/protocol/src/contracts.test.ts`
- Modify: `packages/core/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces: `AppError`, `AppResult<T>`, `CursorPage<T>`, `chatContracts`, `messageContracts`.
- Produces contract tags under `tg.v1.*`.

- [ ] **Step 1: Upgrade Eventa through pnpm**

Run:

```bash
pnpm install -F @tg-search/core @moeru/eventa@1.0.0-beta.11
```

Expected: `packages/core/package.json` and `pnpm-lock.yaml` resolve Eventa beta.11.

- [ ] **Step 2: Add the protocol workspace package**

Use a package manifest with exports from `src/index.ts`, scripts for `typecheck`, `build`, and `test:run`, and dependencies on `@moeru/eventa` beta.11 and `valibot` 1.4.

- [ ] **Step 3: Write failing contract tests**

```ts
it('rejects an empty remote chat id', () => {
  expect(() => parse(listRemoteMessagesInputSchema, {
    chatId: '', limit: 100,
  })).toThrow()
})

it('uses stable versioned tags', () => {
  expect(chatContracts.list.sendEvent.id).toContain('tg.v1.chats.list')
})
```

Run:

```bash
pnpm exec vitest run packages/protocol/src/contracts.test.ts
```

Expected: FAIL because schemas and contracts do not exist.

- [ ] **Step 4: Implement schemas and contracts**

Use this result boundary:

```ts
export interface AppError {
  code: string
  message: string
  retryable: boolean
  retryAfterSeconds?: number
  details?: Record<string, unknown>
}

export type AppResult<T> =
  | { ok: true, data: T }
  | { ok: false, error: AppError }
```

Define invokes with typed results rather than throwing arbitrary cross-transport errors:

```ts
export const messageContracts = {
  listRemote: defineInvokeEventa<AppResult<CursorPage<MessageRecord>>, ListRemoteMessagesInput>('tg.v1.messages.list.remote'),
  queryLocal: defineInvokeEventa<AppResult<CursorPage<MessageRecord>>, QueryLocalMessagesInput>('tg.v1.messages.query.local'),
  searchLocal: defineInvokeEventa<AppResult<CursorPage<SearchMessageRecord>>, SearchMessagesInput>('tg.v1.messages.search.local'),
  contextLocal: defineInvokeEventa<AppResult<MessageContext>, MessageContextInput>('tg.v1.messages.context.local'),
}
```

- [ ] **Step 5: Verify package tests and types**

Run:

```bash
pnpm exec vitest run packages/protocol/src/contracts.test.ts
pnpm -F @tg-search/protocol typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/protocol packages/core/package.json pnpm-lock.yaml
git commit -m "feat(protocol): add eventa application contracts"
```

---

### Task 2: Persist structured message metadata

**Files:**
- Modify: `packages/core/src/schemas/chat-messages.ts`
- Modify: `packages/core/src/models/utils/message.ts`
- Modify: `packages/core/src/models/chat-message.ts`
- Modify: `packages/core/src/types/message.ts`
- Test: `packages/core/src/models/__test__/message-utils.test.ts`
- Create: generated files under `drizzle/`

**Interfaces:**
- Consumes: `MessageRecord` metadata shape from Task 1.
- Produces: `forward`, `media`, and `links` DB round-trip.

- [ ] **Step 1: Add failing metadata round-trip tests**

Construct a `ProcessedCoreMessage` containing forward origin, one document media record, and one link. Assert `convertToDBInsertMessage()` preserves all three and `convertToCoreMessageFromDB()` reconstructs them.

Run:

```bash
pnpm exec vitest run packages/core/src/models/__test__/message-utils.test.ts
```

Expected: FAIL because DB insert conversion drops metadata.

- [ ] **Step 2: Add typed JSONB columns**

Add typed defaults:

```ts
forward: jsonb().$type<CoreMessageForward>().notNull().default({ isForward: false }),
media: jsonb().$type<CoreMessageMedia[]>().notNull().default([]),
links: jsonb().$type<CoreMessageLink[]>().notNull().default([]),
```

Add `CoreMessageLink` and a `links?: CoreMessageLink[]` field to `CoreMessage`.

- [ ] **Step 3: Implement model conversions and conflict updates**

Persist metadata in `convertToDBInsertMessage()` and update it in the message upsert conflict clause with `excluded.forward`, `excluded.media`, and `excluded.links`.

- [ ] **Step 4: Generate the migration**

Run:

```bash
pnpm run db:generate -- --name add-message-structured-metadata
```

Expected: one generated migration and matching Drizzle snapshot/journal updates.

- [ ] **Step 5: Verify focused tests**

Run:

```bash
pnpm exec vitest run packages/core/src/models/__test__/message-utils.test.ts packages/core/src/event-handlers/__test__/storage.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src drizzle
git commit -m "feat(core): persist structured message metadata"
```

---

### Task 3: Build the Core application runtime and unary handlers

**Files:**
- Create: `packages/core/src/application/errors.ts`
- Create: `packages/core/src/application/runtime.ts`
- Create: `packages/core/src/services/remote-messages.ts`
- Create: `packages/core/src/services/local-messages.ts`
- Create: `packages/core/src/handlers/chats.ts`
- Create: `packages/core/src/handlers/messages.ts`
- Create: `packages/core/src/handlers/index.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/handlers/handlers.test.ts`

**Interfaces:**
- Consumes: Task 1 contracts and existing dialog/message/models services.
- Produces: `createTelegramApplicationRuntime()` and `registerApplicationHandlers()`.

- [ ] **Step 1: Write failing in-process handler tests**

Create one Eventa context, register fake application methods, call `defineInvokes`, and assert:

```ts
expect(await invokes.listChats({ limit: 10 })).toEqual({
  ok: true,
  data: { items: [], nextCursor: null },
})
```

Also assert invalid runtime payloads return `INVALID_ARGUMENT` instead of throwing.

- [ ] **Step 2: Run the failing tests**

```bash
pnpm exec vitest run packages/core/src/handlers/handlers.test.ts
```

Expected: FAIL because handler registration does not exist.

- [ ] **Step 3: Implement the application interface**

```ts
export interface TelegramApplication {
  listChats(input: ListChatsInput): Promise<AppResult<CursorPage<ChatRecord>>>
  listRemoteMessages(input: ListRemoteMessagesInput): Promise<AppResult<CursorPage<MessageRecord>>>
  queryLocalMessages(input: QueryLocalMessagesInput): Promise<AppResult<CursorPage<MessageRecord>>>
  searchLocalMessages(input: SearchMessagesInput): Promise<AppResult<CursorPage<SearchMessageRecord>>>
  getLocalMessageContext(input: MessageContextInput): Promise<AppResult<MessageContext>>
  getLocalStats(input: StatsInput): Promise<AppResult<StatsResult>>
}
```

`listRemoteMessages` converts GramJS messages directly and never emits storage events or calls record models. Local methods call models directly.

- [ ] **Step 4: Implement thin validated handlers**

Handlers use `safeParse` and `defineInvokeHandlers`. Validation failure returns `err('INVALID_ARGUMENT', ...)`. Unknown errors go through `toAppError()` with redaction.

- [ ] **Step 5: Verify tests and Core types**

```bash
pnpm exec vitest run packages/core/src/handlers/handlers.test.ts
pnpm -F @tg-search/core typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/application packages/core/src/services packages/core/src/handlers packages/core/src/index.ts
git commit -m "feat(core): expose eventa application runtime"
```

---

### Task 4: Add cancellable auth and synchronization streams

**Files:**
- Create: `packages/protocol/src/auth.ts`
- Create: `packages/protocol/src/sync.ts`
- Modify: `packages/protocol/src/index.ts`
- Create: `packages/core/src/handlers/auth.ts`
- Create: `packages/core/src/handlers/sync.ts`
- Modify: `packages/core/src/application/runtime.ts`
- Test: `packages/core/src/handlers/stream-handlers.test.ts`

**Interfaces:**
- Produces: `authContracts.login`, `authContracts.submitChallenge`, `syncContracts.run`.
- Uses Eventa beta.11 handler `options.abortController.signal`.

- [ ] **Step 1: Write failing stream cancellation and challenge tests**

Test that cancelling the `ReadableStream` returned by `defineStreamInvoke` aborts the handler signal and yields no terminal success. Test a login stream that yields `{ type: 'challenge', flowId, challenge: 'code' }`, accepts `submitChallenge`, then yields `{ type: 'completed' }`.

- [ ] **Step 2: Run tests and confirm failure**

```bash
pnpm exec vitest run packages/core/src/handlers/stream-handlers.test.ts
```

Expected: FAIL because contracts and handlers do not exist.

- [ ] **Step 3: Implement stream contracts**

Use discriminated unions:

```ts
export type SyncUpdate =
  | { type: 'started', taskId: string }
  | { type: 'progress', taskId: string, processed: number, total?: number }
  | { type: 'checkpoint', taskId: string, chatId: string, messageId: string }
  | { type: 'completed', taskId: string, processed: number }
  | { type: 'failed', taskId: string, error: AppError }
```

- [ ] **Step 4: Implement handlers using native cancellation**

Pass `options?.abortController?.signal` into login and takeout task controllers. The sync handler validates that `chatIds.length > 0 || all === true`; otherwise it yields one failed update with `INVALID_ARGUMENT` and returns.

- [ ] **Step 5: Verify stream tests and types**

```bash
pnpm exec vitest run packages/core/src/handlers/stream-handlers.test.ts packages/core/src/services/__test__/takeout.test.ts
pnpm -F @tg-search/protocol typecheck
pnpm -F @tg-search/core typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/protocol/src packages/core/src/handlers packages/core/src/application
git commit -m "feat(core): add cancellable auth and sync streams"
```

---

### Task 5: Add deterministic local export and stats

**Files:**
- Create: `packages/protocol/src/export.ts`
- Create: `packages/protocol/src/stats.ts`
- Modify: `packages/protocol/src/index.ts`
- Create: `packages/core/src/services/export.ts`
- Create: `packages/core/src/handlers/export.ts`
- Modify: `packages/core/src/handlers/index.ts`
- Test: `packages/core/src/services/__test__/export.test.ts`

**Interfaces:**
- Produces: `exportContracts.run` Stream RPC and `statsContracts.get` RPC.

- [ ] **Step 1: Write failing export tests**

Seed temporary PGlite with messages in two months. Assert export creates `manifest.json`, `2026-01.jsonl`, and `2026-02.jsonl`, sorts by `(platformTimestamp, chatId, platformMessageId)`, excludes vectors/session data, and includes checksums.

- [ ] **Step 2: Run the failing test**

```bash
pnpm exec vitest run packages/core/src/services/__test__/export.test.ts
```

Expected: FAIL because export service does not exist.

- [ ] **Step 3: Implement export service**

Write files through `node:fs/promises`, use a temporary filename per month, then rename after completion. Return only relative output paths and counts. Check the abort signal between pages and before rename.

- [ ] **Step 4: Implement stats and export handlers**

Stats groups locally by requested `month`, `chat`, or `sender`. Export streams `started`, per-file `progress`, and `completed` updates.

- [ ] **Step 5: Verify tests**

```bash
pnpm exec vitest run packages/core/src/services/__test__/export.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/protocol/src packages/core/src/services packages/core/src/handlers
git commit -m "feat(core): add local stats and jsonl export"
```

---

### Task 6: Replace the server bridge with account-scoped Eventa contexts

**Files:**
- Modify: `apps/server/src/app.ts`
- Modify: `apps/server/src/account.ts`
- Modify: `apps/server/src/index.ts`
- Delete after migration: `apps/server/src/events.ts`
- Test: `apps/server/src/app.test.ts`

**Interfaces:**
- Consumes: `registerApplicationHandlers()` and Eventa H3 peer adapter.
- Produces: one Eventa context per authenticated peer/account runtime.

- [ ] **Step 1: Write failing isolation tests**

Create two fake peers for different account IDs. Invoke the same contract on both and assert each receives only its account result. Assert disconnect aborts in-flight handlers for that peer without destroying an account runtime still used by another peer.

- [ ] **Step 2: Run tests and confirm failure**

```bash
pnpm exec vitest run apps/server/src/app.test.ts
```

Expected: FAIL against the broadcast-style manual bridge.

- [ ] **Step 3: Implement Eventa peer contexts**

Use `createPeerContext(peer)` from `@moeru/eventa/adapters/websocket/h3`, register handlers with account runtime dependencies, retain disposer functions, and call them on peer close. Resolve account identity during upgrade/open; never accept account ID in invoke payloads.

- [ ] **Step 4: Route realtime notifications through Eventa events**

Map account-scoped Core notifications to the protocol event definitions. Keep `/health`, `/v1/photos/*`, and `/v1/stickers/*` unchanged.

- [ ] **Step 5: Verify server tests and typecheck**

```bash
pnpm exec vitest run apps/server/src/app.test.ts apps/server/src/apis/v1/index.test.ts
pnpm -F @tg-search/server typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server packages/protocol packages/core
git commit -m "refactor(server): use account-scoped eventa rpc"
```

---

### Task 7: Migrate both Web modes to Eventa invokes

**Files:**
- Create: `packages/client/src/adapters/eventa-local.ts`
- Create: `packages/client/src/adapters/eventa-websocket.ts`
- Modify: `packages/client/src/types/bridge.ts`
- Modify: `packages/client/src/composables/useBridge.ts`
- Modify: `packages/client/src/stores/useSession.ts`
- Modify: `packages/client/src/stores/useChat.ts`
- Modify: `packages/client/src/stores/useMessage.ts`
- Modify: `packages/client/src/stores/useSyncTask.ts`
- Delete after migration: `packages/client/src/adapters/core-bridge.ts`
- Delete after migration: `packages/client/src/adapters/websocket.ts`
- Delete migrated files under: `packages/client/src/event-handlers/`
- Test: existing tests under `packages/client/src/stores/__test__/`

**Interfaces:**
- Consumes: protocol invokes/events and Core local handler registration.
- Produces: a bridge exposing `invokes`, `streams`, and subscription cleanup.

- [ ] **Step 1: Update store tests to mock typed invokes**

Replace expectations such as `sendEvent(CoreEventType.DialogFetch)` with `expect(invokes.listChats).toHaveBeenCalledWith(...)`. Add one parity test that local and WebSocket adapters expose the same invoke keys.

- [ ] **Step 2: Run client tests and confirm failure**

```bash
pnpm exec vitest run packages/client/src/stores/__test__ packages/client/src/adapters
```

Expected: FAIL because Eventa adapters do not exist.

- [ ] **Step 3: Implement both Eventa adapters**

Local adapter creates a context, initializes PGlite/Core runtime, registers handlers, and returns `defineInvokes`/`defineStreamInvoke` functions. Remote adapter wraps the native WebSocket and builds the same functions.

- [ ] **Step 4: Migrate stores by vertical slice**

Migrate session/auth, chats, messages/search/context, and sync. Subscribe to notification Eventa only for realtime state changes. Remove each paired request-response event registration after its final consumer moves.

- [ ] **Step 5: Verify client tests and types**

```bash
pnpm exec vitest run packages/client/src/stores/__test__ packages/client/src/adapters
pnpm -F @tg-search/client typecheck
pnpm -F @tg-search/web typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/client apps/web packages/core/src/types/events.ts
git commit -m "refactor(client): consume eventa application contracts"
```

---

### Task 8: Build named profile storage and the publishable CLI

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/tsdown.config.ts`
- Create: `packages/cli/vitest.config.ts`
- Create: `packages/cli/src/index.ts`
- Create: `packages/cli/src/profile.ts`
- Create: `packages/cli/src/runtime.ts`
- Create: `packages/cli/src/output.ts`
- Create: command files under `packages/cli/src/commands/`
- Test: `packages/cli/src/profile.test.ts`
- Test: `packages/cli/src/commands.test.ts`
- Modify: root `package.json`

**Interfaces:**
- Consumes: Eventa protocol invokes/streams and Core in-process runtime.
- Produces: `tg-search` executable and root `cli` script.

- [ ] **Step 1: Add CLI dependencies through pnpm**

Use `citty@0.1.6` as the command parser and add `@tg-search/protocol`, `@tg-search/core`, `@tg-search/common`, and Eventa to `@tg-search/cli`. Install through pnpm after the package manifest exists:

```bash
pnpm install -F @tg-search/cli citty@0.1.6 @moeru/eventa@1.0.0-beta.11 @tg-search/protocol@workspace:* @tg-search/core@workspace:* @tg-search/common@workspace:*
```

- [ ] **Step 2: Write failing profile and output tests**

Assert default profile resolution, named profile path isolation, session file mode `0600`, stdout JSON envelope, and stderr-only progress. Test that two profiles cannot read each other's PGlite path.

- [ ] **Step 3: Implement profile storage**

Expose:

```ts
interface ProfilePaths {
  root: string
  config: string
  session: string
  database: string
  exports: string
}

function resolveProfilePaths(name: string): ProfilePaths
```

Reject names outside `[a-zA-Z0-9._-]+` to prevent path traversal.

- [ ] **Step 4: Implement commands**

Implement profile, auth, chats, messages list/query, sync, search, context, stats, and export. Require `--chat` or `--all` for sync. Local commands create no Telegram client. Remote commands create no message persistence handler.

- [ ] **Step 5: Verify CLI tests and built help**

```bash
pnpm exec vitest run packages/cli/src
pnpm -F @tg-search/cli typecheck
pnpm -F @tg-search/cli build
node packages/cli/dist/index.mjs --help
```

Expected: tests pass and help lists every approved command.

- [ ] **Step 6: Commit**

```bash
git add packages/cli package.json pnpm-lock.yaml
git commit -m "feat(cli): add agent-friendly telegram commands"
```

---

### Task 9: Remove legacy public event RPC and document the CLI

**Files:**
- Modify: `packages/core/src/types/events.ts`
- Modify: `packages/core/src/context.ts`
- Modify: `packages/core/src/instance.ts`
- Modify: `packages/core/src/event-handlers/index.ts`
- Modify: `README.md`
- Create: `packages/cli/README.md`
- Modify: relevant `apps/*/README.md` and `packages/*/README.md` files touched by the migration.

**Interfaces:**
- Removes: public `ToCoreEvent`/`FromCoreEvent` request-response pairs and manual bridge types.
- Retains: true internal domain notifications until their final Eventa migration.

- [ ] **Step 1: Find remaining legacy consumers**

Run:

```bash
rg -n "requestId|waitForEvent|sendEvent\(|StorageSearchMessagesData|DialogFetch|MessageFetch" apps packages
```

Expected: only explicitly retained internal domain paths remain.

- [ ] **Step 2: Remove migrated public pairs and adapters**

Delete request-response interfaces, `requestId` correlation utilities, response queues, and manual WebSocket message union types that have no consumers. Keep internal processing events with comments identifying them as domain-only.

- [ ] **Step 3: Document installation and Agent usage**

Document global install, profiles, remote-read versus sync semantics, stdout/stderr contract, examples for annual export, and privacy boundaries. State that the CLI performs no AI analysis.

- [ ] **Step 4: Run the legacy scan again**

Expected: no client/server RPC uses `CoreEventType`; no manual response queue remains.

- [ ] **Step 5: Commit**

```bash
git add apps packages README.md
git commit -m "refactor(core): remove legacy event rpc bridge"
```

---

### Task 10: Full verification and release readiness

**Files:**
- Modify only files required by formatter/linter or concrete verification failures.

**Interfaces:**
- Verifies the complete approved spec.

- [ ] **Step 1: Run focused test suites**

```bash
pnpm exec vitest run packages/protocol packages/core packages/client packages/cli apps/server
```

Expected: PASS.

- [ ] **Step 2: Run required workspace checks**

```bash
pnpm run typecheck
pnpm run lint:fix
pnpm run test:run
```

Expected: PASS with no new lint or type errors.

- [ ] **Step 3: Build distributable surfaces**

```bash
pnpm run build:packages
pnpm run server:build
pnpm -F @tg-search/cli build
```

Expected: PASS and CLI dist contains its executable entry.

- [ ] **Step 4: Run offline CLI smoke tests**

```bash
node packages/cli/dist/index.mjs profile list --json
node packages/cli/dist/index.mjs --profile smoke messages query --from 2026-01-01 --to 2026-12-31 --json
node packages/cli/dist/index.mjs --profile smoke export --from 2026-01-01 --to 2026-12-31 --format jsonl --output /tmp/tg-search-smoke
```

Expected: valid JSON envelopes on stdout, no Telegram connection for local commands, and a deterministic empty export for a fresh profile.

- [ ] **Step 5: Review diff and commit verification fixes**

```bash
git diff --check
git status --short
git add -u
git commit -m "test: verify eventa cli migration"
```

Skip the final commit when verification produces no file changes.
