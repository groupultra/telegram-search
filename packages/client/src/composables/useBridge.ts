import type { BridgeAdapter } from '../types/bridge'

import { useCoreBridgeAdapter } from '../adapters/core-bridge'
import { useWebsocketAdapter } from '../adapters/websocket'
import { IS_CORE_MODE } from '../constants'

export function useBridge(): BridgeAdapter {
  if (IS_CORE_MODE) {
    return useCoreBridgeAdapter()
  }
  else {
    return useWebsocketAdapter()
  }
}
