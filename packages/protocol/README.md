# @tg-search/protocol

Shared, versioned Eventa application contracts for Telegram Search.

- Unary RPC: chats, remote/local messages, context, search, and stats.
- Stream RPC: authentication, explicit synchronization, and JSONL export.
- Boundary validation: Valibot schemas and `AppResult<T>` error envelopes.
- Stable tags: all public tags use the `tg.v1.*` namespace.

Business services remain ordinary TypeScript functions. This package contains transport contracts only.
