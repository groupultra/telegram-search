---
globs: packages/client/src/**/*
---

## Client Adapters (packages/client)

- **Role**: Bridge between UI (Vue/Pinia) and core (`packages/core`) in both:
  - **Browser-only mode** (embedded core via `core-runtime` / `core-bridge`).
  - **Server mode** (WebSocket adapter to `apps/server`).
- Keep this package thin and focused on:
  - Event wiring.
  - Session/account management.
  - Store updates and derivations for UI consumption.

### Core Runtime & Bridge

- `core-runtime`:
  - Owns the lifecycle of `CoreContext` and DB initialization in browser mode.
  - Exposes helper methods (`getCtx`, `destroy`, etc.) instead of leaking internal implementation.
- `core-bridge`:
  - Manages sessions, the active account slot, and event handler registration.
  - On account switch:
    - Destroy the existing `CoreContext`.
    - Re-register client-side event handlers for the new active account.
  - Never share a single runtime instance across different account IDs.

### Events & Type Safety

- Always go through the typed WebSocket/core event maps:
  - Use `WsEventToServer`, `WsEventToClient`, and `FromCoreEvent` / `ToCoreEvent` types.
  - Avoid untyped `any` payloads or generic `Record<string, unknown>` where stronger types are available.
- When adding new events:
  - Update the shared `@tg-search/server/types`.
  - Extend client event handler maps and registration helpers.
  - Keep the mapping between WS event names and core events explicit.

### Pinia Stores & Composables

- Stores in `packages/client` are the **source of truth** for app state:
  - Use actions to emit events to core and react to `FromCoreEvent` updates.
  - Avoid duplicating the same state in both `apps/web` and `packages/client`.
- For reusable logic, prefer composables and pure utilities inside this package rather than re-implementing logic in components.

### Logging & Error Handling

- Use `useLogger` with a **component/module name** (e.g. `'CoreBridge'`) for all logs in this package.
- Log:
  - High-level intent (event name, account/session IDs).
  - Errors when event delivery or handler invocation fails.
- Do not log sensitive payload data (raw messages, tokens, secrets).
- When something fails:
  - Prefer emitting a client-facing event that the UI can react to (e.g. a `core:error` or domain-specific failure event).
  - Avoid throwing unhandled exceptions that would crash the whole bridge.

