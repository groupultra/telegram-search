import type { BridgeStore } from '../types/bridge'

import { IS_CORE_MODE } from '../../constants'
import { useCoreBridgeStore } from '../adapters/core-bridge'
import { useWebsocketStore } from '../adapters/websocket'

export function useBridgeStore(): BridgeStore {
  if (IS_CORE_MODE) {
    return useCoreBridgeStore()
  }
  else {
    return useWebsocketStore()
  }
}
