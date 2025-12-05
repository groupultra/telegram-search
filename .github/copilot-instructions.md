# Copilot Instructions for telegram-search

This repo is a pnpm-powered monorepo for a Telegram search/export app. It uses an event-driven core with WebSocket bridging, Vue 3 frontend, and Drizzle ORM for storage (PostgreSQL + pgvector or in-browser PGlite).

## Architecture essentials
- Monorepo layout:
  - `apps/web`: Vue 3 app (Pinia, TanStack Query). Can run standalone with `VITE_WITH_CORE=true` (browser-only mode with PGlite).
  - `apps/server`: WebSocket server (h3) that hosts the Core for server mode.
  - `packages/core`: Event-driven Core (EventEmitter3), services, DB models and resolvers.
  - `packages/client`: Browser-side bridge + client event handlers and stores.
  - `packages/common`: Shared config, logger wrapper, utils.
- Core event bus: `packages/core/src/context.ts` creates `CoreContext` around EventEmitter3. All cross-layer comms use events:
  - To Core (requests): `auth:*`, `message:*`, `dialog:*`, `entity:*`, `storage:*`, `takeout:*`, etc.
  - From Core (results): e.g. `auth:connected`, `message:data`, `dialog:data`, `storage:search:messages:data`.
  - Event types and contracts live in `packages/core/src/types/events.ts`. Follow `<domain>:<action>` naming.
- Event handlers and services:
  - Handlers: `packages/core/src/event-handlers/*.ts` map bus events to services.
  - Services: `packages/core/src/services/*.ts` implement business logic and emit results.
  - Message pipeline resolvers in `packages/core/src/message-resolvers/*` (embedding, jieba, link, media, user) operate independently and stream results.
- Client bridge:
  - `packages/client/src/adapters/core-bridge.ts` initializes config/logger, creates Core in browser mode, registers handlers, and forwards events between UI and Core (or WebSocket server).
  - For server mode, the browser uses a WebSocket adapter; the server routes events to a per-connection Core instance.
- Database:
  - Drizzle ORM schemas/models under `packages/core/src/{schemas,models}`; migrations in `drizzle/`.
  - Two modes: PostgreSQL+pgvector (server) and PGlite (browser). Code paths must support both.

## Dev workflows
- Node 24+ and pnpm required. Root scripts:
  - Browser-only: `pnpm dev` (equivalent to `VITE_WITH_CORE=true pnpm -F @tg-search/web dev`).
  - Server mode: `pnpm server:dev` and `pnpm web:dev` (two terminals). DB via `docker compose up -d pgvector`.
  - Builds: `pnpm build`, `pnpm web:build`, `pnpm server:build`, `pnpm packages:build`.
  - Types/tests/lint: `pnpm typecheck` (builds packages first), `pnpm test` (Vitest), `pnpm lint` / `pnpm lint:fix`.
  - DB tools: `pnpm db:generate` (drizzle-kit).
- Config:
  - Browser mode uses `.env` (`VITE_TELEGRAM_API_ID`, `VITE_TELEGRAM_API_HASH`).
  - Server mode uses environment variables (database, Telegram API, optional proxy) loaded via `.env` / `.env.local` and dotenvx. See `docs/ENVIRONMENT.md`.

## Conventions and patterns
- Events are the API. Don’t call services directly across layers; emit on `ctx.emitter` and listen for results. Use types from `packages/core/src/types/events.ts`.
- Naming:
  - Event names: `<domain>:<action>` (e.g. `message:fetch`, `storage:search:messages`). Avoid timestamps for ordering—prefer Telegram message IDs.
  - Files: kebab-case; components: PascalCase; constants: UPPER_SNAKE_CASE.
- Logging & errors:
  - Use `@guiiai/logg` (`useLogger()`). Include `withFields` context and `withError` on failures.
  - Use `ctx.withError(err, description)` to emit `core:error` and log uniformly. In dev, `CoreContext` tracks listener counts and warns on potential leaks; emit `core:cleanup` when tearing down a context.
- Session isolation:
  - Each browser tab/WS connection has its own `CoreContext` and event subscriptions. Avoid global singletons in core logic.
- Storage/search specifics:
  - Vector search via embeddings (OpenAI/Ollama). Resolvers live under `packages/core/src/message-resolvers/embedding-resolver.ts` etc.
  - Storage/search events: `storage:search:messages` -> emits `storage:search:messages:data` with ranked results.

## Where to look for examples
- Event contracts: `packages/core/src/types/events.ts` (e.g., `MessageEventToCore`, `StorageEventFromCore`).
- Handler -> service pattern: `packages/core/src/event-handlers/message.ts` and `packages/core/src/services/message.ts`.
- Client event bridging: `packages/client/src/adapters/core-bridge.ts`.
- DB schema and migrations: `packages/core/src/schemas/*`, `drizzle/*`.

## Gotchas and edge cases
- Message ordering: always use Telegram Message ID over timestamps.
- Dual DB mode: ensure code paths work for both Postgres and PGlite; avoid vendor-specific SQL in core logic.
- Avoid memory leaks: unsubscribe listeners on cleanup and prefer one-time listeners when appropriate.
