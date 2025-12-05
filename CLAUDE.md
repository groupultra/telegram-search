# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Telegram Search is a monorepo application for exporting, backing up, and searching Telegram messages with semantic search capabilities. It uses an event-driven architecture with WebSocket communication between frontend and backend.

## Development Commands

### Setup & Installation

```bash
pnpm install                    # Install all dependencies
cp .env.example .env           # Base env for both browser-only and server mode
```

### Development Modes

**Browser-only mode** (PGlite in-browser database):
```bash
pnpm run dev                   # Start frontend with embedded core
```

**Server mode** (PostgreSQL + WebSocket backend):
```bash
docker compose up -d pgvector  # Start PostgreSQL database
pnpm run server:dev            # Terminal 1: Start backend WebSocket server
pnpm run web:dev              # Terminal 2: Start frontend
```

### Build & Test

```bash
pnpm run build                 # Build frontend (browser mode)
pnpm run web:build            # Build frontend (server mode)
pnpm run server:build         # Build backend server
pnpm run packages:build       # Build all packages (required before typecheck)
pnpm run typecheck            # TypeScript type checking (runs packages:build first)
pnpm run test                 # Run Vitest tests
pnpm run lint                 # ESLint check
pnpm run lint:fix             # Auto-fix ESLint issues
```

### Database Operations

```bash
pnpm run db:generate          # Generate Drizzle migration files
```

## Architecture

### Monorepo Structure

- **`apps/web`**: Vue 3 frontend with Pinia state management
- **`apps/server`**: WebSocket server for real-time communication
- **`packages/core`**: Event bus (EventEmitter3), services, database models (Drizzle ORM)
- **`packages/client`**: Client adapters, event handlers, Pinia stores
- **`packages/common`**: Logger wrapper and shared utilities

### Event-Driven Core

The application is built on an event-driven architecture centered around `CoreContext` (EventEmitter3):

**CoreContext** (`packages/core/src/context.ts`):
- Central event bus managing all system events
- Two event types:
  - `ToCoreEvent`: Events sent TO core (e.g., `auth:login`, `message:query`)
  - `FromCoreEvent`: Events emitted FROM core (e.g., `message:data`, `auth:status`)
- Event naming convention: `<domain>:<action>` (e.g., `storage:sync:start`)
- Each client session has its own isolated CoreContext instance
- Automatic error handling via `ctx.withError(error, description)`

**Event Handlers** (`packages/core/src/event-handlers/`):
- Listen to CoreContext events and delegate to services
- Key handlers: `auth.ts`, `message.ts`, `dialog.ts`, `storage.ts`, `entity.ts`, `config.ts`, `gram-events.ts`, `message-resolver.ts`, `takeout.ts`

**Services** (`packages/core/src/services/`):
- Contain business logic and interact with Telegram API / database
- Each service corresponds to an event handler

**Event Flow**:
1. Frontend (Vue component) triggers action
2. Pinia store sends event via WebSocket/CoreBridge adapter
3. WebSocket server routes event to CoreContext
4. Event handler processes event and calls service
5. Service executes logic (Telegram API / database)
6. Service emits result event through CoreContext
7. Event flows back to frontend via WebSocket
8. Client event handler updates Pinia store
9. Vue components reactively update

### Message Processing Pipeline

Messages are processed through multiple resolvers in `packages/core/src/message-resolvers/`:
- **embedding-resolver.ts**: Generate vector embeddings (OpenAI/Ollama)
- **jieba-resolver.ts**: Chinese word segmentation for search
- **link-resolver.ts**: Extract and process links
- **media-resolver.ts**: Handle media attachments
- **user-resolver.ts**: Process user mentions

Each resolver operates independently in a streaming pipeline.

### Database

**ORM**: Drizzle ORM
- Schemas: `packages/core/src/schemas/`
- Models: `packages/core/src/models/`
- Migrations: `drizzle/` directory

**Database modes**:
- **PostgreSQL + pgvector**: Production mode with vector search
- **PGlite**: Experimental in-browser PostgreSQL for browser-only mode

**Key tables**: `chat_messages`, `chat_message_stats`, `joined_chats`, `photos`, `stickers`, `sticker_packs`

## Important Development Details

### Telegram Client Management

Use `CoreContext` methods to manage the Telegram client:

```typescript
// Set client (done during authentication)
ctx.setClient(telegramClient)

// Get client (ensures it exists)
const client = ctx.getClient()
```

**Critical**: Telegram Message IDs are monotonically increasing. Always prefer using Message ID over timestamps for message ordering and processing.

### Logging

Use `@guiiai/logg` wrapped in `packages/common`:

```typescript
import { useLogger } from '@guiiai/logg'

useLogger().log('Basic message')
useLogger().withFields({ userId: 123 }).log('With context')
useLogger().withError(error).error('Error occurred')
```

### Error Handling

Use CoreContext's error handler:

```typescript
ctx.withError(error, 'Operation description')
```

This automatically:
- Emits `core:error` event to frontend
- Logs error with context
- Handles special Telegram errors (FloodWaitError, RpcError)

### Configuration

**Browser mode**: `.env` file
- `VITE_TELEGRAM_API_ID`
- `VITE_TELEGRAM_API_HASH`

**Server mode**: environment variables (loaded via `.env` / `.env.local` and dotenvx)
- Database settings (`DATABASE_TYPE`, `DATABASE_URL`)
- Telegram API (`TELEGRAM_API_ID`, `TELEGRAM_API_HASH`)
- Optional proxy configuration (`PROXY_URL`, `PROXY_MT_PROXY`, etc.)

### Code Standards

**TypeScript**: Strict type checking enabled
- Always use explicit type annotations
- Prefer interfaces and type definitions
- Run `pnpm run typecheck` before committing

**Naming conventions**:
- Files: kebab-case (`user-service.ts`)
- Components: PascalCase (`UserProfile.vue`)
- Functions/variables: camelCase (`getUserData`)
- Types/interfaces: PascalCase (`UserData`)
- Constants: UPPER_SNAKE_CASE (`API_BASE_URL`)

**Event naming**: `<domain>:<action>` pattern
- Examples: `auth:login`, `message:query:vector`, `storage:sync:progress`

### Package Manager

**Primary**: `pnpm` (required)
**Alternative**: If `ni` is installed, use `ni` (install) and `nr` (run scripts)

### Testing

Test framework: Vitest
- Test files: `*.spec.ts` or `*.test.ts`
- Run: `pnpm run test`

## Key Technical Considerations

1. **Event-driven architecture**: All communication flows through CoreContext events
2. **Session isolation**: Each WebSocket connection has its own CoreContext instance
3. **Message ID priority**: Always use Message ID (not timestamps) for message operations
4. **Streaming processing**: Message resolvers process data in streams, not batches
5. **Type safety**: Strict TypeScript with full type coverage required
6. **Dual database support**: Code must work with both PostgreSQL and PGlite
7. **Telegram API library**: Uses `gram.js` for Telegram integration
