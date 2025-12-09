---
globs: apps/web/src/**/*, apps/web/index.html, apps/web/uno.config.ts, apps/web/vite.config.ts, apps/web/typed-router.d.ts
---

## Frontend (apps/web)

- **Role**: Deliver the Telegram search UI. All business logic and side effects should live in `packages/client` / `packages/core`, not in Vue components.
- **Architecture**:
  - Use **Composition API** with `<script setup lang="ts">` by default. Avoid Options API for new code.
  - Keep components small and focused; extract logic into composables in `apps/web/src/composables` or into `packages/client`.
  - Do not access Telegram or the database directly from `apps/web`; always go through `@tg-search/client`.

### Routing, Layouts & Navigation

- Use the auto-generated routes from `vue-router/auto-routes` and `virtual:generated-layouts`.
- Prefer **file-based routing** conventions over manual route declarations.
- Guard routes via Pinia stores or client events (auth status), not ad‑hoc `localStorage` checks in components.
- When adding navigation transitions or loading states:
  - Integrate with the existing `NProgress` guards in `main.ts` instead of ad‑hoc spinners in every page.

### State & Data Fetching

- Global/shared state belongs in **Pinia** stores (either in `apps/web/src/stores` or `packages/client`).
- For async data and server/core interactions:
  - Prefer **TanStack Query** (`@tanstack/vue-query`) for request lifecycle, caching, and background refetch.
  - Model long‑running operations (imports, indexing, sync) as events and progress updates flowing through `@tg-search/client`, not as raw HTTP calls from components.
- Never call `initDrizzle` or mutate `CoreContext` directly from `apps/web`; that belongs in `packages/client`.

### UI, Styling & UX

- Use **UnoCSS** utilities and the existing presets (`unocss`, `unocss-preset-shadcn`, `@proj-airi/unocss-preset-chromatic`) as the primary styling tools.
- Keep layout and visual primitives reusable:
  - Extract repeated patterns into small components under `apps/web/src/components`.
  - Avoid deep CSS overrides; prefer class-based composition.
- Respect accessibility basics:
  - Use semantic HTML elements and proper labels for inputs and buttons.
  - Ensure keyboard navigation works for any new interactive components.

### Error Handling & Notifications

- Surface user-facing errors via consistent UI (e.g. toast/notification component or error blocks), not `alert` or silent failures.
- For unexpected errors:
  - Log via `@guiiai/logg` only inside `packages/client` / `packages/common`; the web app should avoid its own logging layer beyond dev tooling.
  - Show a generic message to the user; do not display raw stack traces.

### Devtools & PGlite

- PGlite devtools (`@unbird/pglite-inspector`) must remain **development-only**:
  - Guard setup with `import.meta.env.DEV` as in `main.ts`.
  - If you add more devtools hooks, wire them behind the same guard and avoid impacting production bundle size significantly.

