import { defineEventa } from '@moeru/eventa'

/** Server connection established — sent to client after WebSocket handshake */
export const serverConnectedEvent = defineEventa<{
  sessionId: string
  accountReady: boolean
}>('server:connected')
