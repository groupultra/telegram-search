# Telegram Search in ChatGPT Work

The server includes an opt-in, read-only MCP endpoint at `/mcp`. It queries the same account-scoped database used by the remote CLI. No second Telegram session, message copy, or search index is created.

This integration is experimental. Automated tests cover the MCP transport and access-token validation. Production identity-provider authorization, Railway deployment, and installation inside ChatGPT Work still need live acceptance.

## Capabilities

| Tool | Purpose |
| --- | --- |
| `search` | Standard search tool: returns up to 20 message source IDs, titles, and URLs. |
| `search_messages` | Search with chat/time filters and cursor pagination. |
| `fetch` | Retrieve a source message with up to 10 indexed messages on either side. |

All tools are read-only. Only already-indexed messages are searched. Exhausting a search cursor does not prove the index contains the complete Telegram history. Source URLs open the existing TGS web app at `/chat/<chatId>?messageId=<messageId>`; the reader must be signed in there to the same account.

## Authentication model

ChatGPT authenticates with an external OAuth authorization server. The MCP service acts only as a resource server: it verifies signed access tokens against configured public keys on every request. It does not implement a login page, token issuance, or refresh-token storage.

The initial version is a personal deployment: one allowed OAuth subject is explicitly mapped to one existing TGS database account UUID. A valid token for another user or another resource is rejected. This is not a multi-tenant account-linking service. Telegram credentials never pass through ChatGPT.

Configure an OAuth provider that supports the authorization-code flow with S256 PKCE and resource indicators. Its discovery metadata must advertise the appropriate authorization/token endpoints and `code_challenge_methods_supported: ["S256"]`. Use a predefined OAuth client or supported client registration. The provider must issue RS256 or ES256 JWT access tokens with:

- `iss`: exactly the configured issuer, including its trailing slash if present.
- `aud`: exactly the public MCP resource URL ending in `/mcp`.
- `sub`: the allowed user subject.
- `exp`: an expiration timestamp.
- `scope`: containing `telegram:read`.

The provider must honor `resource` during authorization and token exchange and allow the exact callback URI shown by ChatGPT. Do not substitute an ID token, Telegram session, or the CLI's static access token for an MCP access token.

## Server configuration

Set all six variables through your hosting provider's environment settings:

| Variable | Meaning |
| --- | --- |
| `TG_SEARCH_MCP_RESOURCE_URL` | Public HTTPS resource URL, for example `https://tgs.example.com/mcp`. Path must be `/mcp`. |
| `TG_SEARCH_MCP_ISSUER` | Exact OAuth issuer from the provider's discovery document. |
| `TG_SEARCH_MCP_JWKS_URL` | HTTPS signing-key endpoint for that issuer. |
| `TG_SEARCH_MCP_SUBJECT` | OAuth subject permitted to access this personal deployment. |
| `TG_SEARCH_MCP_ACCOUNT_ID` | Existing TGS database account UUID, not a Telegram numeric ID or WebSocket session ID. |
| `TG_SEARCH_MCP_WEB_URL` | HTTPS base URL of the TGS web app associated with this server. |

With none configured, MCP is disabled. Partial or malformed configuration stops startup. The independent `TG_SEARCH_REMOTE_*` CLI settings are not required for MCP. Keep the database on persistent storage and apply an ingress request-rate limit. Never cache authenticated MCP responses. No migration or data consolidation is performed by enabling the endpoint.

The service publishes OAuth protected-resource metadata at `/.well-known/oauth-protected-resource/mcp` and the root discovery path. Unauthorized requests receive a `WWW-Authenticate` challenge pointing at that metadata. The external provider owns authorization-server discovery. The transport is stateless Streamable HTTP with JSON responses; GET/DELETE are not used for persistent sessions.

## Connect in ChatGPT Work

1. Deploy the server at a stable HTTPS address and configure the identity provider and subject/account mapping above.
2. In a workspace that permits custom MCP servers/plugins, add the `/mcp` URL through the developer integration flow. For a predefined OAuth client, enter its client configuration through ChatGPT's trusted setup UI.
3. Copy ChatGPT's exact displayed redirect URI into the OAuth provider's allowlist. Complete the account-linking flow and verify the identity provider sends the configured audience and scope.
4. Inspect the discovered tools. Use the connected app in a Work conversation or include it in a plugin using Plugin Creator. Workspace permissions control whether this setup and plugin use are available.
5. Ask for a known indexed phrase, paginate with `search_messages`, fetch a result, and open its source URL. Repeat with the local computer turned off.

Do not mark live acceptance complete until wrong-user authorization is rejected, expired access tokens trigger reauthorization/refresh through the provider, a server restart preserves indexed queries, and the Work search/fetch flow succeeds without the local computer. Revoking the OAuth provider session may not invalidate an already-issued JWT immediately; use short-lived access tokens, or disable MCP/change the allowed subject for immediate service-side revocation.

## Local validation

```bash
pnpm --filter @tg-search/protocol --filter @tg-search/schema --filter @tg-search/observability build
pnpm --dir apps/server exec vitest run src/mcp/mcp.test.ts
pnpm --filter @tg-search/server typecheck
```

The tests use signed test JWTs and a real loopback HTTP server with the official MCP client. They verify discovery, initialization, tools, search/fetch, pagination, account mapping, invalid input, and rejection of wrong signatures/issuer/audience/subject/scope/expiry. The data collaborator is a fixture, so these tests do not establish production database contents or live OAuth account linking.

## Official references

- [Build an MCP server](https://developers.openai.com/plugins/build/mcp-server)
- [OAuth authentication](https://developers.openai.com/plugins/build/auth)
- [Connect and test in ChatGPT](https://developers.openai.com/plugins/deploy/connect-chatgpt)
- [Create and use plugins in Work](https://learn.chatgpt.com/docs/build-plugins)
