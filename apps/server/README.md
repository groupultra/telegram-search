# @tg-search/server

Node/H3 server for Telegram Search.

## Remote CLI access

The authenticated read API is disabled by default. To enable it, configure both server secrets:

- `TG_SEARCH_REMOTE_TOKEN`: a random access token of at least 32 characters. For example, generate one with `openssl rand -hex 32` and store it in your hosting provider's secret settings.
- `TG_SEARCH_REMOTE_ACCOUNT_ID`: the existing database account UUID whose data this deployment exposes. This is the `accounts.id` reported by `AccountReady`, not a numeric Telegram user ID or a WebSocket session ID. Confirm it belongs to the intended account before enabling access.

Clients set `TG_SEARCH_REMOTE_TOKEN` and pass the HTTPS server base URL through `--remote`, `TG_SEARCH_REMOTE_URL`, or `profile remote <url>`. Rotate the server token and update clients to revoke old access. This initial access model exposes one explicitly configured account per deployment; it is not multi-user OAuth.

`POST /v1/remote/:method` accepts JSON and `Authorization: Bearer <token>`. Methods are `chats.list`, `messages.list`, `messages.query`, `messages.search`, `messages.context`, and `stats.get`. Requests reuse protocol validation and the Core application. The server selects the account from configuration, never from request input. No sync, arbitrary RPC, filesystem export, or account-management endpoint is exposed.

Indexed queries use the existing server database even after restart. Live Telegram reads require an active, authorized account runtime on this server and return `TELEGRAM_NOT_CONNECTED` otherwise. This API does not restore Telegram sessions after restart or migrate/merge local data. Use HTTPS termination and an ingress request-rate limit; responses must not be cached.

### Security boundary

The bearer token grants all exposed reads for the configured account, not just selected chats. It has no automatic expiry; rotate it to revoke access. Request JSON cannot choose the account. Stored query/context reads check the account's recorded chat membership in addition to existing private-message ownership rules. Membership reflects the local index, not a live revalidation of Telegram permissions. Existing legacy private-message rows with a NULL owner retain the Core compatibility policy; this is not a tenant-isolation guarantee for legacy multi-account databases.

These checks protect `/v1/remote/*` only. They do not add authorization to the existing `/ws`, `/v1/photos/*`, or `/v1/stickers/*` routes. Publish only the required integration routes on the integration ingress, and keep the existing web/media surface behind its own access control. A configured token is not a security wrapper around the whole TGS server. The server process and database administrators remain trusted. Do not log request bodies, tokens, or query text in production; set an appropriate production log level.

The `/ws` route creates account-scoped Eventa peer contexts and keeps HTTP for health checks and binary photo/sticker delivery. During the UI migration, true realtime domain notifications continue to share the same WebSocket connection.
