---
globs: drizzle/**/*, sql/**/*, packages/core/src/schemas/**/*, packages/core/src/models/**/*
---

## Database & Migrations

- **Role**: Provide a consistent schema and migration history that works in both:
  - PostgreSQL with pgvector (server mode).
  - PGlite (browser-only mode).

### Schema Definition

- Treat the TypeScript schema in `packages/core/src/schemas` / `models` as the **source of truth**.
- Ensure any schema change is reflected consistently in:
  - TS schema/models.
  - Generated Drizzle migrations under `drizzle/`.
  - Any raw SQL helpers under `sql/` if present.
- Prefer Drizzle's typed query APIs over raw SQL to keep Postgres and PGlite behavior aligned.

### Migrations

- Use `drizzle-kit` (`pnpm run db:generate`) to generate new migrations; avoid hand-writing large SQL files.
- For production-safe changes:
  - Make migrations forward-only and additive when possible.
  - Avoid destructive operations without a clear, tested migration path.
- If a generated migration needs manual tweaks:
  - Keep custom SQL focused and well-commented.
  - Verify both Postgres and PGlite behavior where applicable.

### Performance & Indexing

- For vector search:
  - Ensure vector dimensions match the configured embedding model.
  - Use pgvector indexes where needed, and make them explicit in migrations.
- For analytical queries (stats, charts):
  - Prefer precalculated or indexed aggregates over complex ad‑hoc joins on hot paths.

