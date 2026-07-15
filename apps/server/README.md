# @tg-search/server

Node/H3 server for Telegram Search.

The `/ws` route creates account-scoped Eventa peer contexts and keeps HTTP for health checks and binary photo/sticker delivery. During the UI migration, true realtime domain notifications continue to share the same WebSocket connection.
