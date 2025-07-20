# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Telegram Search is a powerful Telegram chat history search tool with vector search and semantic matching capabilities. It's built as a modular monorepo using Vue 3, TypeScript, and a PostgreSQL database with vector search support.

## Development Commands

### Core Development
- `pnpm install` - Install all dependencies
- `pnpm run dev:server` - Start backend server (port varies)
- `pnpm run dev:frontend` - Start frontend development server (port 3333)
- `pnpm run dev:electron` - Start Electron desktop app

### Building and Testing
- `pnpm run build:packages` - Build all packages in parallel
- `pnpm run lint` - Run ESLint with cache
- `pnpm run lint:fix` - Auto-fix ESLint issues
- `pnpm run typecheck` - Run TypeScript type checking across all packages

### Database Operations
- `pnpm run db:migrate` - Run database migrations
- `pnpm run db:push` - Push schema changes to database
- `pnpm run db:generate` - Generate Drizzle migration files
- `pnpm run db:kit` - Run database utility scripts

### Docker Development
- `docker compose up -d pgvector` - Start only the PostgreSQL database
- `docker compose up -d` - Start all services including database

## Architecture Overview

### Modular Monorepo Structure
- **apps/** - Applications (server, frontend, electron)
- **packages/** - Shared packages with specific responsibilities
- **config/** - Configuration files (copy from config.example.yaml)

### Key Packages
- **@tg-search/core** - Central orchestration, Telegram client management, event system
- **@tg-search/db** - Database layer with Drizzle ORM, supports PostgreSQL and PGlite
- **@tg-search/client** - Frontend state management with Pinia stores and WebSocket handling
- **@tg-search/common** - Shared utilities, configuration schemas, cross-platform code
- **@tg-search/stage-ui** - Vue 3 component library with UnoCSS styling

### Event-Driven Architecture
The system uses a typed event system with:
- `CoreContext` as the central coordinator
- Service handlers for different domains (messages, dialogs, auth)
- WebSocket communication between frontend and server
- Message resolvers for content processing (embeddings, media, links)

### Data Flow
Frontend (Vue) ↔ WebSocket ↔ Server ↔ Core Context ↔ Telegram API
                                     ↓
                               Database Layer (Drizzle)
                                     ↓
                            PostgreSQL/PGlite Storage

## Development Setup

1. Copy configuration: `cp config/config.example.yaml config/config.yaml`
2. Start database: `docker compose up -d pgvector`
3. Run migrations: `pnpm run db:migrate`
4. Start development servers:
   - Backend: `pnpm run dev:server`
   - Frontend: `pnpm run dev:frontend`

## Important Development Notes

### Package Manager
- Uses pnpm with workspace configuration
- All packages are linked via workspace protocol
- Catalog feature used for shared dependency versions

### Database
- Primary: PostgreSQL with pgvector extension for semantic search
- Development: Can use PGlite for local development
- Migrations managed through Drizzle Kit
- Vector embeddings stored for semantic message search

### Frontend Technology Stack
- Vue 3 with Composition API
- Pinia for state management
- Vue Router with file-based routing
- UnoCSS for styling with shadcn/ui components
- TypeScript throughout with strict typing

### Message Processing
- Messages fetched from Telegram API via core context
- Processed through resolver pipeline (embeddings, media, users)
- Stored with full-text search capabilities
- Real-time updates via WebSocket events

### WebSocket Events
- Bidirectional communication with typed events
- Client connects to server WebSocket endpoint
- Events include auth status, message updates, sync progress

### Testing
- Vitest for unit tests in packages
- TypeScript strict mode enabled
- ESLint configuration with custom rules

## Configuration

The application uses YAML configuration files:
- `config/config.yaml` - Main configuration (copy from example)
- Database connection settings
- Telegram API credentials
- Feature flags and behavior settings
