# Repository Guidelines

## Project Structure & Module Organization
- apps/: runnable apps
  - apps/frontend: Vite + Vue 3 web UI
  - apps/server: API + WS gateway (vite-node)
  - apps/electron: Desktop shell (electron-vite)
- packages/: shared libraries
  - client, core, common, stage-ui
- drizzle/: generated SQL/migrations
- config/: runtime configuration (copy config.example.yaml)
- scripts/: helper scripts (e.g., scripts/db.ts)
- docs/: documentation and assets

## Build, Test, and Development Commands
- Install: `pnpm install` (Node >= 22.18)
- Frontend dev: `pnpm run dev:frontend` → http://localhost:3333
- Server dev: `pnpm run dev:server` (requires DB ready)
- Electron dev: `pnpm run dev:electron`
- Build web: `pnpm run build`; preview: `pnpm run preview`
- Build packages: `pnpm run packages:build`
- Tests: `pnpm test` (Vitest)
- Lint: `pnpm lint` | fix: `pnpm lint:fix`
- DB (Drizzle): `pnpm run db:migrate` | `pnpm run db:push`

## Coding Style & Naming Conventions
- Language: TypeScript, strict mode enabled. Vue 3 for UI.
- Indentation: 2 spaces; LF endings (.editorconfig)
- ESLint: root config via `@unbird/eslint-config`; run `pnpm lint`
- File names: kebab-case for files, PascalCase for Vue SFC components, camelCase for TS symbols.
- Package names: `@tg-search/<scope>`; avoid breaking public APIs without discussion.

## Testing Guidelines
- Framework: Vitest.
- Location: place tests next to code under `src/**`.
- Naming: `*.spec.ts` or `*.test.ts` (see `packages/*/vitest.config.ts`).
- Run: `pnpm test` from repo root. Keep tests deterministic and fast.

## Commit & Pull Request Guidelines
- Commit style: Conventional Commits (e.g., `feat: ...`, `fix: ...`, `chore: ...`).
- PRs must include:
  - Clear description and rationale; link related issues.
  - Steps to test; include screenshots/GIFs for UI changes.
  - Checklist: `pnpm lint`, `pnpm test`, build(s) pass locally.

## Security & Configuration Tips
- Do not commit secrets. Use `.env` (frontend hints) and `config/config.yaml` for runtime config.
- Database: PostgreSQL + pgvector. For local dev, start with `docker compose up -d pgvector` then run migrations.
- Telegram API: set `VITE_TELEGRAM_APP_ID` and `VITE_TELEGRAM_APP_HASH` (see `.env.example`).
