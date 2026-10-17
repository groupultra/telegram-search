# @tg-search/server

Node/H3 server for Telegram Search.

## Remote CLI access

The authenticated read API is disabled by default. To enable it, configure both server secrets:

- `TG_SEARCH_REMOTE_TOKEN`: a random access token of at least 32 characters. For example, generate one with `openssl rand -hex 32` and store it in your hosting provider's secret settings.
- `TG_SEARCH_REMOTE_ACCOUNT_ID`: the existing database account UUID whose data this deployment exposes. This is the `accounts.id` reported by `AccountReady`, not a numeric Telegram user ID or a WebSocket session ID. Confirm it belongs to the intended account before enabling access.

Clients set `TG_SEARCH_REMOTE_TOKEN` and pass the HTTPS server base URL through `--remote`, `TG_SEARCH_REMOTE_URL`, or `profile remote <url>`. Rotate the server token and update clients to revoke old access. This initial access model exposes one explicitly configured account per deployment; it is not multi-user OAuth.

`POST /v1/remote/:method` accepts JSON and `Authorization: Bearer <token>`. Methods are `chats.list`, `messages.get`, `messages.replies`, `messages.read`, `messages.list`, `messages.query`, `messages.search`, `messages.context`, `media.read`, `media.createLink`, and `stats.get`. Requests reuse protocol validation and the Core application. The server selects the account from configuration, never from request input. No sync, arbitrary RPC, filesystem export, or account-management endpoint is exposed.

Indexed queries use the existing server database even after restart. Live Telegram reads require an active, authorized account runtime on this server and return `TELEGRAM_NOT_CONNECTED` otherwise. This API does not restore Telegram sessions after restart or migrate/merge local data. Use HTTPS termination and an ingress request-rate limit; responses must not be cached.

### Temporary media links

`media.createLink` accepts `{ source, chatId, messageId, mediaIndex?, maxBytes? }` and checks attachment ownership, identity, availability, and size before issuing a link. It returns `{ path, expiresAt, media }`; `path` is relative and `expiresAt` is Unix milliseconds. Clients combine the path with their configured, trusted remote endpoint. The server never derives a public hostname from request or forwarded headers.

The returned `GET /v1/remote/media.download?ticket=…` URL returns complete binary content without an Authorization header. `HEAD` checks its metadata without downloading bytes. The encrypted, authenticated capability identifies one attachment and expires after five minutes; requests may reuse it until expiry, including after a server restart or on another replica with the same configured token and account. Rotating the bearer invalidates issued links. An edited or unavailable attachment requires a new link. Other remote methods retain their existing bearer authentication.

Treat the complete download URL as a secret: anyone holding it can read that attachment until expiry. Keep tickets out of application and ingress logs, issues, and unrelated output. The response uses `no-store` and `nosniff`; only PNG, JPEG, and WebP render inline, while other formats use a safely encoded attachment filename.

Downloads use a bounded in-memory buffer, with a 10 MiB default limit and 50 MiB maximum. At most two GET/HEAD transfers or buffered response bodies are active per server process; additional requests return `503 MEDIA_DOWNLOAD_BUSY` with `Retry-After`. A sixty-second absolute deadline includes metadata checks, downloading, and body consumption, so an idle client cannot retain a buffer indefinitely. Links expire for new requests; a transfer admitted before expiry remains subject to its own sixty-second deadline. Responses contain the whole file and do not advertise range support or transcode content.

The source is explicit. `local` currently serves stored photos and stickers and returns `MEDIA_NOT_STORED` for other indexed attachment types; it never starts a Telegram download automatically. `telegram` fetches the current authorized message and supports photos and document-backed files, including audio, video, and stickers. Downloading a format does not imply a model can interpret it. A temporary link does not change media synchronization or the existing web photo/sticker routes.

### Security boundary

The bearer token grants all exposed reads for the configured account, not just selected chats. It has no automatic expiry; rotate it to revoke access. Request JSON cannot choose the account. Stored query/context/point/window reads check the account's recorded chat membership in addition to existing private-message ownership rules. Membership reflects the local index, not a live revalidation of Telegram permissions. Existing legacy private-message rows with a NULL owner retain the Core compatibility policy; this is not a tenant-isolation guarantee for legacy multi-account databases.

These checks protect `/v1/remote/*` only. They do not add authorization to the existing `/ws`, `/v1/photos/*`, or `/v1/stickers/*` routes. Publish only the required integration routes on the integration ingress, and keep the existing web/media surface behind its own access control. A configured token is not a security wrapper around the whole TGS server. The server process and database administrators remain trusted. Do not log request bodies, tokens, or query text in production; set an appropriate production log level.

The `/ws` route creates account-scoped Eventa peer contexts and keeps HTTP for health checks and binary photo/sticker delivery. During the UI migration, true realtime domain notifications continue to share the same WebSocket connection.
