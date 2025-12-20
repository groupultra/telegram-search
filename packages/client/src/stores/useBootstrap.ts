import { useLogger } from '@guiiai/logg'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'

import { useBridgeStore } from '../composables/useBridge'
import { useAccountStore } from './useAccount'
import { useChatStore } from './useChat'

export type BootstrapPhase = 'idle' | 'authing' | 'accountReady' | 'ready'

/**
 * Frontend bootstrap orchestrator.
 *
 * Responsible for:
 * - Initializing the bridge (websocket or core-bridge)
 * - Kicking off best-effort auto-login for the active account
 * - Marking high-level bootstrap phases for other stores to reference if needed
 *
 * Note: Backend already runs its own bootstrap via afterConnectedEventHandler.
 * This store focuses purely on client-side orchestration.
 */
export const useBootstrapStore = defineStore('bootstrap', () => {
  const logger = useLogger('BootstrapStore')
  const bridgeStore = useBridgeStore()
  const accountStore = useAccountStore()
  const chatStore = useChatStore()

  const phase = ref<BootstrapPhase>('idle')

  /**
   * Start bootstrap on app startup.
   * - Initialize bridge (creates websocket/core-bridge runtime)
   * - Trigger AuthStore auto-login for the active slot
   */
  async function start() {
    if (phase.value !== 'idle') {
      logger.debug('Bootstrap already started, skipping')
      return
    }

    logger.debug('Starting frontend bootstrap')

    // Ensure transport layer (websocket or core-bridge) is initialized.
    if (typeof bridgeStore.init === 'function')
      await bridgeStore.init()

    phase.value = 'authing'

    // Delegate auto-login logic to AccountStore; it will try to restore the
    // active slot using stored session if available.
    accountStore.init()
  }

  /**
   * Mark account as ready and perform client-side post-bootstrap work.
   * Should be called once core has established current account context,
   * typically after receiving entity:me:data.
   */
  function markAccountReady() {
    if (phase.value === 'ready')
      return

    logger.debug('Marking account as ready; initializing chat store')
    phase.value = 'accountReady'

    // Hydrate dialogs for the active account. In core-bridge mode, core
    // will have already emitted storage:dialogs as part of its bootstrap.
    // In websocket mode, ChatStore.init() will explicitly request dialogs.
    chatStore.init()

    phase.value = 'ready'
  }

  return {
    phase,
    start,
    markAccountReady,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useBootstrapStore, import.meta.hot))
}
