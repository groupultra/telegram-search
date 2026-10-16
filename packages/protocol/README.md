# @tg-search/protocol

Shared, versioned Eventa application contracts for Telegram Search.

- Unary RPC: chats, remote/local messages, context, search, and stats.
- Stream RPC: explicit synchronization and JSONL export.
- Boundary validation: Valibot schemas and `AppResult<T>` error envelopes.
- Stable tags: all public tags use the `tg.v1.*` namespace.

Business services remain ordinary TypeScript functions. This package contains transport contracts only.

Interactive Telegram login is intentionally a local CLI bootstrap operation. Authentication secrets and sessions do not cross the shared Eventa application boundary.

`messageRecordSchema` is the canonical message fact schema. Point reads (`messages.get`) require an explicit `local` or `telegram` source and 1–100 IDs. Reply traversal (`messages.replies`) and window pagination (`messages.read`) have explicit depth/node/page/message budgets and coverage results. Window exhaustion does not imply reply or attachment inspection.
