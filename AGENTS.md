# Project Coded Agent Guide

Concise but detailed reference for contributors working in the `groupultra/telegram-search` monorepo. Improve code when you touch it; avoid one-off patterns.

## Tech Stack (by surface)

- **Server (`apps/server`)**: Node.js, TypeScript, Drizzle ORM, Postgres/pgvector, WebSocket + REST, dotenvx.
- **Web (`apps/web`)**: Vue 3 + Vite, Pinia.
- **Core/shared (`packages/*`)**: common types, client SDK, schema, core services, bot.
- **Tooling**: pnpm workspaces, Vitest, ESLint, TypeScript 5.9, tsdown, Drizzle Kit.

## Structure & Responsibilities

- **Apps**
  - `apps/server`: backend service (runtime entry in `apps/server/src/`).
  - `apps/web`: web UI (source in `apps/web/src/`).
- **Packages**
  - `packages/`: shared libraries and domain logic used by apps.
- **Root tooling**
  - Linting: `eslint.config.ts`.
  - DB tooling: `drizzle/`, `drizzle.config.ts`.
  - Workspace: `pnpm-workspace.yaml`.

## Key Path Index (what lives where)

- `apps/server/src`: API, WebSocket, and session services.
- `apps/web/src`: Vue UI and client-side logic.
- `packages/core`: core domain/services.
- `packages/schema`: shared types + DB schema.
- `packages/client`: client SDKs for integration.
- `docker/`: compose files + init scripts for local/dev.
- `.env.example`: baseline env config.

## Commands (pnpm with filters)

> Use pnpm workspace filters to scope tasks, e.g. `pnpm -F @tg-search/server dev`.

- **Dev (web only)**: `pnpm run web:dev`
- **Dev (server only)**: `pnpm run server:dev`
- **Dev (web + server)**: `pnpm run start`
- **Build web**: `pnpm run build`
- **Build server**: `pnpm run server:build`
- **Run tests**: `pnpm run test:run`
- **Coverage**: `pnpm run test:coverage`
- **Lint**: `pnpm run lint` / `pnpm run lint:fix`
- **Typecheck**: `pnpm run typecheck`
- **DB generate**: `pnpm run db:generate`

## Dependency Management Rule

- Do not edit `package.json` directly to add/remove deps. Use `pnpm install` so lockfile and manifest stay in sync.
- For workspace deps: `pnpm install -F <target> <dependency>` (add `-D` for dev deps).
- Tooling like `typescript`, `vite`, `vitest`, `tsdown`, `@types/node` belongs at the workspace root (`-w`).

## Styling & Conventions

- Favor clear module boundaries; shared logic goes in `packages/`.
- Keep runtime entrypoints lean; move heavy logic into services/modules.
- Prefer functional patterns for testability; use DI where helpful. Avoid classes unless required by APIs.
- Use Valibot for schema validation; keep schemas close to their consumers.
- Use Eventa (`@moeru/eventa`) for structured IPC/RPC contracts where needed.
- File names: `kebab-case`.
- Do not add backward-compatibility guards. If extended support is required, write refactor docs and complete the change in a separate, well-scoped effort.
- If the refactor scope is small, do a progressive refactor step by step.
- When modifying code, look for small, safe refactors to reduce duplication or improve clarity.
- If you need a workaround, add a `// NOTICE:` comment explaining why, the root cause, and any relevant context.

## Testing Practices

- Use Vitest for unit/integration tests.
- Mock external services and Postgres where practical; keep tests deterministic.
- When fixing a bug, add a Vitest test that documents the previous failure mode and include a short `//` comment about the cause.
- For DB interactions, prefer migration-driven integration tests with env guards.

## TypeScript / Tooling

- Stay strict with types; avoid `any` unless absolutely necessary.
- Prefer small, composable modules; keep exports minimal and intentional.

## Refactoring & Comments

- Prefer progressive, incremental refactors that keep behavior stable.
- Keep existing comments with the code when moving/refactoring. If a comment becomes obsolete, replace it with a brief note about why it was removed.
- Use markers consistently: `// TODO:`, `// REVIEW:`, `// NOTICE:`.
- Add concise comments for complex logic, algorithms, OS-interaction, and shared utilities. Avoid obvious comments.

## PR / Workflow Tips

- Keep changes scoped; use workspace filters for commands.
- Summarize changes, how tested (commands), and follow-ups.
- Improve legacy when you touch it; avoid one-off patterns.
- Maintain structured `README.md` documentation for each `packages/` and `apps/` entry.
- Always run `pnpm run typecheck` and `pnpm run lint:fix` after finishing a task.
- Use Conventional Commits (e.g., `feat(server): add session refresh`).

## Docker + SQL Conventions

- Use `docker-compose.yml` as the compose filename.
- Do not write SQL migration files manually. Always use `drizzle-kit generate` to create migrations, which will be placed in `**/sql/` with descriptive, kebab-case names.
- Avoid Postgres enums to keep migrations and imports flexible.
