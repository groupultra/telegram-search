import type { EventHandler } from 'h3'

// H3 does not export the Peer type directly, so we extract it from the `message` hook of the WebSocket event handler.
type Hooks = NonNullable<EventHandler['__websocket__']>
export type Peer = Parameters<NonNullable<Hooks['message']>>[0]
