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
| `/api/auth/*`, `/mcp`, `/.well-known/oauth-*`, `/.well-known/openid-configuration*` | unchanged: OAuth issuer and MCP resource identifiers include these paths |
| `/api/*` (everything else) | with the `/api` prefix removed |

The proxy must preserve the `Host` header for `/mcp`.

## Server sign-in (`TGS_AUTH=oauth`)

When the server runs with OAuth, the WebSocket needs a signed-in session. On start the app reads `GET /api/auth/get-session`:

- `404`: the server runs without OAuth; the app starts as before.
- No session: every route except `/auth/*` redirects to `/auth/sign-in`, and the WebSocket bridge does not start.
- A session: the app starts; the Telegram account login at `/login` follows as before.

Pages under `src/pages/auth/` serve the authorization server's flow:

| Page | Purpose |
|---|---|
| `/auth/sign-in` | Telegram sign-in. With a signed authorization request in the query, it resumes that request after Telegram returns. |
| `/auth/consent` | Shows the requesting client and scopes; Allow or Deny returns to the client. |
| `/auth/device` | Approves a `tgs remote login` device code. |

The client for these endpoints is `src/lib/server-auth.ts`; the sign-in state lives in `src/stores/server-auth.ts`.
