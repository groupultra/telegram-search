# @tg-search/client

Vue/Pinia client integration for Telegram Search.

Both browser-local and server WebSocket modes expose the same Eventa application bridge. Chat discovery and message read/context operations use the versioned protocol invokes; realtime UI notifications and the remaining media/settings operations continue through domain events while their contracts are migrated.

## Connection recovery

Server mode retries a closed WebSocket every two seconds while its account slot exists. A browser `online` event retries immediately. A heartbeat runs every 30 seconds and closes an unresponsive connection after ten seconds. The server must support the `server:ping` / `server:pong` heartbeat frames.

Each connection registers its listeners before processing the server's account readiness handshake. A restarted server restores authorization from the browser's saved Telegram session; a server that retained its account reuses that runtime. Consecutive identical messages are processed individually. Disconnected actions fail instead of being buffered across reconnects or account switches.

Failed saved-session logins retry with delays of 2, 4, 8, 16, then 30 seconds until recovery. Explicit authorization failure, logout, account changes and store disposal cancel recovery. A failed Telegram authorization probe preserves the original error: network failures do not mean the session was revoked. Server restarts still require a browser with a valid saved session; this change does not persist server-side authorization or replace GramJS's established-connection retry policy.

The approach follows [Telegram Web A's transport implementation](https://github.com/Ajaxy/telegram-tt/blob/ea0d226147a80f05253bf1a6ffef08d694b8e6e4/src/lib/gramjs/network/MTProtoSender.ts): retain authorization across transport failures, retry while connected by user intent, and distinguish broken authorization from temporary disconnection. TGS uses its existing VueUse WebSocket adapter rather than copying the MTProto transport or replaying application mutations.
