# @tg-search/server

Node/H3 server for Telegram Search.

## Remote CLI access

The authenticated API is disabled by default. Set `TG_SEARCH_REMOTE_ACCESS` to a JSON policy with one or more credentials:

```json
{
  "credentials": [
    {
      "id": "2ac3a9a8-5b58-4be6-a659-f4b794f54f10",
      "name": "project-reader",
      "token": "replace-with-at-least-32-random-characters",
      "accountId": "20eff9ca-a2f9-4556-a5f8-39bca8f61951",
      "expiresAt": 1798761600000,
      "capabilities": ["chats.list", "messages.list", "messages.query", "messages.search", "messages.context", "stats.get"],
      "chatPermissions": [
        { "chatId": "123456", "permissions": ["read"] },
        { "chatId": "789012", "permissions": ["read"] }
      ]
    }
  ]
}
```

Generate each token with `openssl rand -hex 32`. `id` and `accountId` are database UUIDs; `accountId` is the `accounts.id` reported by `AccountReady`, not a numeric Telegram user ID. `expiresAt` is an optional Unix timestamp in milliseconds. Use `{ "chatId": "*", "permissions": ["read"] }` only when a credential should read every chat.

Each client supplies its own token through `TG_SEARCH_REMOTE_TOKEN` and passes the HTTPS server base URL through `--remote`, `TG_SEARCH_REMOTE_URL`, or `profile remote <url>`. Remove or expire a credential to revoke it; use a new credential ID and token when rotating access.

`POST /v1/remote/:method` accepts JSON and `Authorization: Bearer <token>`. Methods are `chats.list`, `messages.list`, `messages.query`, `messages.search`, `messages.context`, and `stats.get`. Requests reuse protocol validation and the Core application. The server selects the account from configuration, never from request input. No sync, arbitrary RPC, filesystem export, or account-management endpoint is exposed.

Indexed queries and selected-chat discovery use the existing server database even after restart. Listing every chat and reading live Telegram messages require an active, authorized account runtime on this server and return `TELEGRAM_NOT_CONNECTED` otherwise. This API does not restore Telegram sessions after restart or migrate/merge local data. Use HTTPS termination and an ingress request-rate limit; responses must not be cached.

### Security boundary

Credentials are denied by default. A request needs both the exact method capability and read permission for every requested chat. Queries without `chatIds` are restricted to the credential's readable chats; explicit mixed authorized/unauthorized scopes fail with `PERMISSION_DENIED` instead of returning partial results. Request JSON cannot choose the account. Stored query/context reads also check the account's recorded chat membership and existing private-message ownership rules. Membership reflects the local index, not a live revalidation of Telegram permissions. Existing legacy private-message rows with a NULL owner retain the Core compatibility policy; this is not a tenant-isolation guarantee for legacy multi-account databases.

Every authenticated request writes an append-only row to `remote_audit_events` before its response is returned. The row records the credential, account, method, chat scope, authorization decision, outcome, timing, and sanitized request/result summaries. Search text is stored only as its length and SHA-256 hash. Tokens and message contents are never written to the audit table. If audit persistence fails, the remote request fails closed.

These checks protect `/v1/remote/*` only. They do not add authorization to the existing `/ws`, `/v1/photos/*`, or `/v1/stickers/*` routes. Publish only the required integration routes on the integration ingress, and keep the existing web/media surface behind its own access control. A configured policy is not a security wrapper around the whole TGS server. The server process and database administrators remain trusted. Do not log request bodies, tokens, or query text in production; set an appropriate production log level.

The `/ws` route creates account-scoped Eventa peer contexts and keeps HTTP for health checks and binary photo/sticker delivery. During the UI migration, true realtime domain notifications continue to share the same WebSocket connection.
