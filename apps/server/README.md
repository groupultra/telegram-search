# @tg-search/server

Node/H3 server for Telegram Search.

## Source layout

| Path | Contents |
|---|---|
| `src/index.ts` | Bootstrap: config, database, media storage, routes by `TGS_AUTH` mode |
| `src/oauth.ts` | OAuth mode wiring: mounts the authorization server, `/mcp`, and `/v1/remote`, and returns the Web session guard |
| `src/auth/` | Better Auth instance (`better-auth.ts`), `TGS_AUTH` config, Telegram session sign-in (`telegram-session.ts`), token-to-principal resolution, Web session guard |
| `src/remote/` | Remote methods shared by REST and MCP: executor (scopes, chat scope, audit), REST transport (`http.ts`), scopes, audit recorder, media links, account application |
| `src/mcp/` | Streamable HTTP MCP endpoint and tool registration |
| `src/app.ts`, `src/account.ts`, `src/events.ts` | WebSocket bridge and per-account Core state |
| `src/apis/`, `src/storage/` | Web photo/sticker routes and media storage |

## Authorization modes

`TGS_AUTH` selects the mode:

- `none` (default): a single-user server. The Web UI, `/ws`, and media routes have no authentication, and the remote API and MCP endpoint do not exist. Run it only where the network already restricts access.
- `oauth`: TGS is an OAuth 2.1 authorization server. Users sign in by logging in to Telegram in the Web UI; ChatGPT, Codex, and the CLI obtain access tokens; the Web media routes require a signed-in session.

`oauth` requires every variable below and refuses to start without them:

| Variable | Value |
|---|---|
| `TGS_PUBLIC_URL` | Canonical HTTPS origin without a path, for example `https://tgs.example.com`. HTTP is accepted only on loopback. The token issuer is `<TGS_PUBLIC_URL>/api/auth` and the protected resource is `<TGS_PUBLIC_URL>/mcp`. |
| `BETTER_AUTH_SECRET` | At least 32 random characters (`openssl rand -hex 32`). It also derives the media link key. |
| `TGS_ADMIN_TELEGRAM_IDS` | Optional comma-separated Telegram user IDs that may use `database:admin`. |

`TG_SEARCH_REMOTE_ACCESS` and `TG_SEARCH_REMOTE_TOKEN` were removed. The server refuses to start while `TG_SEARCH_REMOTE_ACCESS` or `TG_SEARCH_REMOTE_TOKEN` is set, so an old access policy cannot be silently ignored. Migrate by setting `TGS_AUTH=oauth` and signing each client in again.

### Identity and tenancy

Logging in to Telegram is the sign-in. The Web UI logs in over the WebSocket as before (phone code, two-step password, or a saved session). Once that account is ready, the browser sends `server:sign-in-ticket`, and the server answers with a ticket for the Telegram user the runtime is logged in as; the identity never comes from the request. The browser exchanges the ticket at `POST /api/auth/sign-in/telegram-session` for a session cookie. Tickets are random, stored only as a SHA-256 hash, expire after two minutes, and are consumed atomically on first use.

The linked account (`providerId: "telegram"`) is keyed by the Telegram user ID, which access tokens carry as `telegram_id`. Better Auth requires an email address and Telegram provides none, so each user gets a synthetic `tg-<id>@users.telegram.invalid` address; email sign-in and linking by email are disabled.

When an authorization request sent the user to `/auth/sign-in`, the page passes the signed request back as `oauth_query`. Better Auth verifies its signature before the ticket is consumed and, once the session is set, answers `{ redirect: true, url }` with the next step (consent or the client).

An access token may act only on the TGS account whose `platform_user_id` equals the signed-in user's Telegram ID. That account exists after the same Telegram user logs in to Telegram on this server. Until then every call returns `403 TELEGRAM_NOT_CONNECTED`; a token never falls back to another account.

### Scopes

| Scope | Methods |
|---|---|
| `chats:read` | `chats.list` |
| `messages:read` | `messages.get`, `messages.replies`, `messages.read`, `messages.list`, `messages.query`, `messages.search`, `messages.context`, `stats.get` |
| `media:read` | `media.read`, `media.createLink` |
| `database:admin` | `database.indexes.list`, `database.indexes.drop`, `database.indexes.rebuild`, `database.vector.get`, `database.vector.set` |

The server removes `database:admin` from every token whose user is not listed in `TGS_ADMIN_TELEGRAM_IDS`, whatever the consent screen granted. An owner token reads every chat of its own account; chat-level grants are not available yet.

### Clients

- **ChatGPT and other MCP clients** connect to `<TGS_PUBLIC_URL>/mcp` (Streamable HTTP). They discover the authorization server from `/.well-known/oauth-protected-resource/mcp` and register through Client ID Metadata Documents. Dynamic client registration is disabled.
- **Codex** adds the same URL as a remote MCP server and signs in with `codex mcp login <name>`.
- **The CLI** uses the public `tgs-cli` client and the device authorization grant: `tgs remote login` prints a verification URL and code to approve in a browser signed in to this server's Web UI. See the CLI README.

The sign-in (`/auth/sign-in`), consent (`/auth/consent`), and device approval (`/auth/device`) pages belong to the Web UI. `TGS_PUBLIC_URL` is the origin that serves both the Web UI and these routes, so a proxy in front of the server must forward `/api/auth/` without stripping its prefix, and `/mcp` and `/.well-known/oauth-*` unchanged. Until a Web UI release with these pages is deployed, `TGS_AUTH=oauth` cannot complete a browser sign-in. Third-party MCP clients cannot request `database:admin`; only the `tgs-cli` client can.

Run the server behind a proxy that preserves the `Host` header (for nginx, `proxy_set_header Host $host;`). `/mcp` rejects requests whose host differs from `TGS_PUBLIC_URL`, and browser requests whose `Origin` names another host.

### MCP tools

Each remote method is one tool named with `_` instead of `.` (`messages_search`). A client sees only the tools its scopes allow. Tool calls go through the same validation, scope checks, and audit as `POST /v1/remote/:method`, so both transports reject the same input. Tool results carry the method's `data` as structured content; failures return `isError` with the remote error code.

### REST remote API

`POST /v1/remote/:method` accepts JSON and `Authorization: Bearer <access token>`, with the same methods as the MCP tools. The token must be issued for the `<TGS_PUBLIC_URL>/mcp` resource. Requests reuse protocol validation and the Core application. The server selects the account from the token, never from request input. No sync, arbitrary RPC, filesystem export, or account-management endpoint is exposed.

Indexed queries and selected-chat discovery use the existing server database even after restart. Listing every chat and reading live Telegram messages require an active, authorized account runtime on this server and return `TELEGRAM_NOT_CONNECTED` otherwise. This API does not restore Telegram sessions after restart or migrate/merge local data. Use HTTPS termination and an ingress request-rate limit; responses must not be cached.

### Database maintenance

`database.indexes.list`, `database.indexes.drop`, `database.indexes.rebuild`, `database.vector.get`, and `database.vector.set` back the CLI's `db` commands. They act on the whole server database, not one account, so they need the `database:admin` scope, which only users in `TGS_ADMIN_TELEGRAM_IDS` keep. An administrator signs the CLI in with `tgs remote login --admin`. The indexes of Better Auth's `auth_*` tables are not managed by these commands.

The vector switch is stored in the `system_settings` table and defaults to enabled. While it is disabled, the server skips embedding and photo-embedding generation, serves vector search requests with text search, and drops vector indexes after migrations at startup. Index DDL runs with `CONCURRENTLY` on Postgres. A long `rebuild` can outlast HTTP client and ingress timeouts while Postgres keeps building; check progress with `database.indexes.list`.

### Temporary media links

`media.createLink` accepts `{ source, chatId, messageId, mediaIndex?, maxBytes? }` and checks both the token's capability and chat permission before inspecting the attachment. It returns `{ path, expiresAt, media }`; `path` is relative and `expiresAt` is Unix milliseconds. Clients combine the path with their configured, trusted remote endpoint. The server never derives a public hostname from request or forwarded headers.

The returned `GET /v1/remote/media.download?ticket=…` URL returns complete binary content without an Authorization header. `HEAD` checks its metadata without downloading bytes. The encrypted, authenticated capability identifies one account attachment and expires after five minutes; requests may reuse it until expiry, including after a server restart or on another replica with the same `BETTER_AUTH_SECRET`. Rotating the secret invalidates every issued link; revoking a client stops new links, and links it already issued expire within five minutes. An edited or unavailable attachment requires a new link. Other remote methods retain their bearer authentication.

Treat the complete download URL as a secret: anyone holding it can read that attachment until expiry. Keep tickets out of application and ingress logs, issues, and unrelated output. The response uses `no-store` and `nosniff`; only PNG, JPEG, and WebP render inline, while other formats use a safely encoded attachment filename.

Downloads use a bounded in-memory buffer, with a 10 MiB default limit and 50 MiB maximum. At most two GET/HEAD transfers or buffered response bodies are active per account in each server process; additional requests return `503 MEDIA_DOWNLOAD_BUSY` with `Retry-After`. A sixty-second absolute deadline includes metadata checks, downloading, and body consumption, so an idle client cannot retain a buffer indefinitely. Links expire for new requests; a transfer admitted before expiry remains subject to its own sixty-second deadline. Responses contain the whole file and do not advertise range support or transcode content.

The source is explicit. `local` currently serves stored photos and stickers and returns `MEDIA_NOT_STORED` for other indexed attachment types; it never starts a Telegram download automatically. `telegram` fetches the current authorized message and supports photos and document-backed files, including audio, video, and stickers. Downloading a format does not imply a model can interpret it. A temporary link does not change media synchronization or the existing web photo/sticker routes.

### Security boundary

Access is denied by default. A request needs both the exact method capability and read permission for every requested chat. Queries without `chatIds` are restricted to the token's readable chats; explicit mixed authorized/unauthorized scopes fail with `PERMISSION_DENIED` instead of returning partial results. Request JSON cannot choose the account. Stored query/context reads also check the account's recorded chat membership and existing private-message ownership rules. Membership reflects the local index, not a live revalidation of Telegram permissions. Existing legacy private-message rows with a NULL owner retain the Core compatibility policy; this is not a tenant-isolation guarantee for legacy multi-account databases.

Every authenticated request writes an append-only row to `remote_audit_events` before its response is returned. The row records the OAuth client ID (`credential_id`), user, account, method, chat scope, authorization decision, outcome, timing, and sanitized request/result summaries. Search text is stored only as its length and SHA-256 hash. Tokens and message contents are never written to the audit table. If audit persistence fails, the remote request fails closed.

With `TGS_AUTH=oauth`, `/mcp` and `/v1/remote/*` require an access token, and `/v1/photos/*` and `/v1/stickers/*` require a signed-in session. `/ws` stays open to signed-out browsers because the Telegram login runs over it; as in the single-user mode, its unguessable client-chosen `sessionId` scopes the account runtime. Upgrades whose `Origin` is not `TGS_PUBLIC_URL` are refused with 403. Anyone who can log in to a Telegram account can sign up. Photo and sticker routes check the session, not the photo's account, so a signed-in user who knows another account's media ID can fetch it. The server process and database administrators remain trusted: the server can read every account it serves. Do not log request bodies, tokens, or query text in production; set an appropriate production log level.

The `/ws` route creates account-scoped Eventa peer contexts and keeps HTTP for health checks and binary photo/sticker delivery. During the UI migration, true realtime domain notifications continue to share the same WebSocket connection.
