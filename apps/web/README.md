# @tg-search/web

Vue 3 + Vite Web UI for Telegram Search.

## Modes

- **Server mode** (`pnpm run web:dev`, `pnpm run web:build`): the UI talks to `apps/server` over `/ws` and fetches media from `/api/v1/*`.
- **Browser-only mode** (`pnpm dev`, `pnpm build`, `VITE_WITH_CORE=true`): the core runs in the browser on PGlite; there is no server.

## Routing to the server

The dev server (`vite.config.ts`) and the production nginx (`docker/nginx.conf`) forward the same routes to `BACKEND_URL`:

| Path | Forwarded as |
|---|---|
| `/ws` | unchanged, WebSocket |
| `/api/auth/*`, `/mcp`, `/v1/remote/*`, `/.well-known/oauth-*`, `/.well-known/openid-configuration*` | unchanged: OAuth issuer and MCP resource identifiers include these paths, and `tgs` calls `/v1/remote/*` with tokens for that resource |
| `/api/*` (everything else) | with the `/api` prefix removed |

The proxy must preserve the `Host` header for `/mcp`.

## Server sign-in (`TGS_AUTH=oauth`)

Logging in to Telegram at `/login` is the sign-in. On start the app reads `GET /api/auth/get-session`:

- `404`: the server runs without OAuth; nothing else happens.
- No session: once the Telegram account is ready (after `/login`, or right away with a saved session), the app sends `server:sign-in-ticket` over the WebSocket and exchanges the ticket at `POST /api/auth/sign-in/telegram-session` for a session cookie.

Pages under `src/pages/auth/` serve the authorization server's flow:

| Page | Purpose |
|---|---|
| `/auth/sign-in` | Where the server sends a client's authorization request. When Telegram is not logged in yet, it sends the user to `/login` with itself as `redirect`; once the account is ready the app returns here, and the page resumes the signed request from its own URL. Nothing about the request is stored in the browser. |
| `/auth/consent` | Shows the requesting client and scopes; Allow or Deny returns to the client. |
| `/auth/device` | Approves a `tgs remote login` device code. |

The client for these endpoints is `src/lib/server-auth.ts`; the sign-in state and the ticket exchange live in `src/stores/server-auth.ts`, and the return from `/login` is in `src/App.vue`.

## Layout and appearance

- **Shell** (`src/layouts/default.vue`): on desktop a navigation rail (`components/layout/AppRail.vue`), a collapsible chat list (`ChatPanel.vue`), then the page. On mobile a bottom tab bar (`MobileNav.vue`). Pages start with `components/layout/PageHeader.vue`.
- **UI primitives** (`src/components/ui/`): every screen is built from these (Button, ActionIcon, Input, Select, Segmented, Switch, Checkbox, Tag, Badge, ListItem, FormItem, Empty, Alert, Statistic, Progress, Skeleton, Tooltip, Popover, DropdownMenu, ContextMenu, Dialog). Sizes, radii, colors, and motion come from the shared recipes in `components/ui/styles.ts`; the values follow LobeUI's Base UI components, ported onto Reka UI. Do not restyle a control at its call site: add a variant to the primitive instead. `/debug/ui` shows them all on one page.
- **Design tokens** (`src/styles/main.css`, mapped in `uno.config.ts`): surfaces `bg-layout` / `bg-container` / `bg-elevated`, overlay fills `bg-fill` to `bg-fill-4`, lines `border-line` / `border-line-2`, text `text-fg` to `text-fg-4`, radii `rounded-xs|sm|md|lg` (4 / 6 / 8 / 12 px), shadows `shadow-popup` / `shadow-modal`. Controls are 24, 32, or 40 px tall.
- **Themes** (`src/composables/use-appearance.ts`): light, dark, or system mode, plus an accent theme (`mono` by default). An accent only overrides the `--primary*` variables through `[data-accent="…"]` on `<html>`. To add one, add its key and swatch to `ACCENT_THEMES`, its two rules (light and dark) to `main.css`, and its name under `appearance.accents` in each locale.
- Both choices are stored in `localStorage` (`vueuse-color-scheme`, `tg-search/accent`); the inline script in `index.html` applies them before first paint.
