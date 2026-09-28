# @tg-search/client

Vue/Pinia client integration for Telegram Search.

`useAccountStore().qrLogin` owns transient QR authentication state in both bridge modes. It ignores events from older attempts, clears displayed tokens when authentication changes phase, and exposes start, cancel, and two-factor password actions. QR tokens and passwords are never persisted by this state.

Both browser-local and server WebSocket modes expose the same Eventa application bridge. Chat discovery and message read/context operations use the versioned protocol invokes; realtime UI notifications and the remaining media/settings operations continue through domain events while their contracts are migrated.
