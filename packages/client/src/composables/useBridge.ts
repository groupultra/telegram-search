import type { BridgeAdapter } from '../types/bridge'

import { IS_CORE_MODE } from '../../constants'
import { useCoreBridgeAdapter } from '../adapters/core-bridge'
import { useWebsocketAdapter } from '../adapters/websocket'

export function useBridge(): BridgeAdapter {
  if (IS_CORE_MODE) {
    return useCoreBridgeAdapter()
  }
  else {
    return useWebsocketAdapter()
  }
}
