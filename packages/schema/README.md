# @tg-search/schema

Bundles the generated root `drizzle/` migrations for Node and browser database initialization.

## Build

Run `pnpm exec turbo run build --filter=@tg-search/schema` from the repository root. The package task hashes the root migration SQL, journal and snapshots in addition to its own source files, so cached artifacts cannot silently omit a newly generated migration.

Generate migrations with Drizzle Kit; do not edit migration SQL manually.

## Validation

After building, `pnpm -F @tg-search/core exec vitest run src/db/migrations.test.ts` applies the bundled migrations to a fresh in-memory PGlite database and verifies the native message metadata column through an insert/read round trip. It does not access a profile database.
