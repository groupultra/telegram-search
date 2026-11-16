# OAuth Authorization and MCP Server Design

Date: 2026-11-16
Status: Implemented in the server pull request; Web pages pending

## 1. Context

TGS exposes three network surfaces today:

- `/v1/remote/*` authenticates static bearer credentials from the `TG_SEARCH_REMOTE_ACCESS` JSON policy (`apps/server/src/remote.ts`). An operator generates each token and hands it to a user; each token maps to one `accountId`, a set of method capabilities, and chat read grants. Every request writes a `remote_audit_events` row.
- `/ws` trusts the `sessionId` query parameter and has no authentication (`apps/server/src/app.ts`).
- `/v1/photos/*` and `/v1/stickers/*` have no authentication.

The Telegram MTProto session string is not stored by the server. Web keeps it in browser localStorage (`packages/client/src/stores/useSession.ts`); the CLI keeps it in the profile `session` file with mode 0600 (`packages/cli/src/profile.ts`).

We want to run TGS as a shared service that users connect to their own ChatGPT and Codex. ChatGPT and Codex connect to third-party tools over remote MCP and authorize with OAuth 2.1 (PKCE, RFC 9728 protected-resource metadata, and Client ID Metadata Documents or dynamic client registration).

## 2. Goals

- One authorization model for every network surface: OAuth 2.1 access tokens for API and MCP clients, and an authorization-server session for the Web UI.
- A remote MCP endpoint (Streamable HTTP) that exposes the existing read methods as tools.
- Users sign in with Telegram; no operator-issued tokens.
- A signed-in user can reach only the TGS account whose Telegram user ID equals their own.
- Keep the existing capability checks, chat scoping, result scope assertion, and fail-closed audit.

## 3. Non-goals

- Storing or encrypting MTProto session strings on the server. That is a separate change (Section 10).
- Write tools (send, edit, delete). MCP exposes read methods only.
- Chat-level grants chosen on the consent page. The first version grants the owner's whole account; chat selection is a follow-up.
- Running the authorization server separately from the resource server.

## 4. Library choices

Verified against installed packages on 2026-11-16:

| Concern | Package | Notes |
|---|---|---|
| Authorization server | `better-auth@1.7.25`, `@better-auth/mcp@1.7.25` (built on `@better-auth/oauth-provider`) | `mcp({ resource, loginPage, consentPage, scopes })` binds tokens to the MCP resource and serves `/.well-known/oauth-protected-resource`. Registration is opt-in. Access tokens are JWTs signed by the `jwt()` plugin. |
| Client registration | `@better-auth/cimd@1.7.25` | `metadataProfile: "mcp-2026-07-28"`. DCR (`allowDynamicClientRegistration`) stays off unless a client needs it. |
| Telegram sign-in | `better-auth` `genericOAuth()` | Telegram OIDC: discovery at `https://oauth.telegram.org/.well-known/openid-configuration`, code flow with PKCE, Basic client authentication, client ID is the bot ID from BotFather. |
| CLI sign-in | `better-auth` `deviceAuthorization()` | RFC 8628 device flow replaces `TG_SEARCH_REMOTE_TOKEN`. |
| Token verification | `@better-auth/mcp` `requireMcpAuth` | Verifies signature, issuer, audience, expiry, `azp`; answers 401 with the RFC 9728 challenge and 403 `insufficient_scope`. |
| MCP protocol | `@modelcontextprotocol/server@2.4.0` | `createMcpHandler(factory).fetch(request, { authInfo })` is fetch-native and mounts on h3 v2. Stateless per request; the factory builds a server for the request's principal. |
| Storage | `@better-auth/drizzle-adapter@1.7.25`, provider `pg` | Tables are added to `packages/core/src/schemas`, and migrations come from `drizzle-kit generate`. |

We do not implement OAuth endpoints ourselves: PKCE, redirect URI matching, single-use codes, refresh rotation, revocation and key rotation are security-critical and the MCP authorization profile is still changing.

## 5. Identity and tenancy

1. The user signs in with Telegram OIDC, scopes `openid profile`.
2. Telegram has no UserInfo endpoint. `getUserInfo` verifies the ID token with `jose` against Telegram's JWKS (`iss = https://oauth.telegram.org`, `aud = <bot id>`, `exp`) and reads the Telegram user ID from the `id` claim. `sub` is not the Telegram user ID.
3. Better Auth requires an email and Telegram returns none. The mapped user gets `tg-<id>@users.telegram.invalid` with `emailVerified: false`, marked `// NOTICE:` in code. Email sign-in and account linking by email stay disabled, so the synthetic address can never match a real one.
4. The linked `auth_accounts` row is keyed by the Telegram user ID (`accountSubject`), and the access token carries it as the `telegram_id` claim. It is not a user field: Better Auth user fields marked `input: false` are also dropped from the OAuth profile mapping, and a user-editable field would let a user claim another Telegram ID.
5. The tenancy rule: a principal may act on the `accounts` row where `platform = 'telegram'` and `platform_user_id = <Telegram id>`. The row is created when that user completes the MTProto login on this server. No row means `TELEGRAM_NOT_CONNECTED`.

## 6. Scopes and principal

OAuth scopes map onto existing remote methods:

| Scope | Methods |
|---|---|
| `chats:read` | `chats.list` |
| `messages:read` | `messages.get`, `messages.replies`, `messages.read`, `messages.list`, `messages.query`, `messages.search`, `messages.context`, `stats.get` |
| `media:read` | `media.read`, `media.createLink` |
| `database:admin` | `database.*`, granted only to Telegram IDs in `TGS_ADMIN_TELEGRAM_IDS` |

`RemoteCredential` becomes `RemotePrincipal`, derived from verified token claims instead of a static policy:

```ts
interface RemotePrincipal {
  clientId: string // token azp, recorded as the audit credential
  clientName: string
  userId: string
  accountId: string // resolved by the tenancy rule
  capabilities: ReadonlySet<RemoteMethod> // expanded from granted scopes
  readableChatIds?: readonly string[] // undefined: the owner reads every chat
}
```

`requireCapability`, `scopeChatIds`, `assertResultScope` and the audit recorder keep their behavior and take a principal. `remote_audit_events.credential_id` stores the OAuth client ID; a column rename is not needed.

## 7. Surfaces

| Route | Authorization after this change |
|---|---|
| `/api/auth/*` | Better Auth handler: OAuth endpoints, Telegram callback, device flow, JWKS, discovery |
| `/.well-known/oauth-authorization-server`, `/.well-known/openid-configuration`, `/.well-known/oauth-protected-resource` | Served by Better Auth at the origin root |
| `/mcp` | `requireMcpAuth` with the MCP resource as audience |
| `/v1/remote/:method` | Same verifier and the same `/mcp` audience; used by the CLI. A second resource would need its own protected-resource metadata and client linking for no isolation gain, since both surfaces expose the same methods with the same checks |
| `/v1/remote/media.download` | Ticket capability as today, key now derived from `BETTER_AUTH_SECRET` with an HKDF purpose label; the ticket binds `accountId` and `clientId` |
| `/ws` | Better Auth session cookie; each `sessionId` belongs to the first user that opens it |
| `/v1/photos/*`, `/v1/stickers/*` | Better Auth session cookie. Per-account ownership of a media ID is a follow-up |

Media tickets currently derive their key from the static credential's token hash, so rotating a credential revokes its links. With OAuth the key is server-wide; revoking a client stops new links, and issued links still expire after five minutes.

## 8. MCP tools

One tool per read method, named after the method with `.` replaced by `_` (`messages_search`). Input schemas come from the existing Valibot schemas in `@tg-search/protocol`. Each tool call goes through the same handler path as `/v1/remote/:method` (scope, invoke, result scope assertion, audit), so MCP and REST cannot drift. Tool results return the JSON body as structured content plus a text rendering.

Host and Origin validation run before the MCP handler, as the SDK requires for fetch-native mounts.

## 9. Configuration and modes

New environment variables:

- `TGS_PUBLIC_URL`: canonical HTTPS origin; issuer and resource identifiers derive from it.
- `BETTER_AUTH_SECRET`: at least 32 random bytes.
- `TELEGRAM_LOGIN_CLIENT_ID`, `TELEGRAM_LOGIN_CLIENT_SECRET`: from BotFather Login Widget; register `<TGS_PUBLIC_URL>/api/auth/oauth2/callback/telegram`.
- `TGS_ADMIN_TELEGRAM_IDS`: optional comma-separated list.
- `TGS_AUTH`: `none` (default) or `oauth`.

`TGS_AUTH=none` keeps today's single-user behavior for `/ws` and media routes and disables `/mcp` and `/v1/remote`. `TGS_AUTH=oauth` requires every variable above and refuses to start without them.

`TG_SEARCH_REMOTE_ACCESS` and `TG_SEARCH_REMOTE_TOKEN` are removed without a compatibility path. The server README documents the migration.

## 10. Follow-up: server-side session storage

A shared service has to restore MTProto sessions after a restart. The follow-up stores them in a new table with envelope encryption (AES-256-GCM per record, data key wrapped by a key from KMS or env, `account_id` as additional authenticated data). That protects database dumps and backups, not the server process, which must decrypt to talk to Telegram.

## 11. Delivery

- Server pull request: authorization server, Telegram sign-in, MCP endpoint, principal refactor, protected `/ws` and media routes, CLI device flow, removal of static credentials, migrations, README.
- Web pull request: login page, consent page, account connection flow. ChatGPT end-to-end verification needs both.

## 12. Verification plan

Run in rc:

- Unit: scope expansion, tenancy resolution, Telegram ID token verification (signature, issuer, audience, expiry, missing `id`), media ticket binding.
- Integration on PGlite with migrations: discovery documents, 401 challenge on `/mcp` without a token, 403 `insufficient_scope`, a token for user A denied on account B, audit row written for MCP calls, audit failure fails closed.
- Device flow against `/v1/remote` from the CLI.
- Manual after the Web pull request: ChatGPT developer mode and `codex mcp login` against a staging URL.

## 13. Open questions

- Does `TGS_AUTH=none` stay, or does every deployment require OAuth?
- Do we need sign-in methods besides Telegram?
- Consent page chat selection: first version or follow-up?
