import type { ServerAuthStatus } from '../lib/server-auth'

import { useLogger } from '@guiiai/logg'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'

import { IS_CORE_MODE } from '../constants'
import { getServerAuthStatus } from '../lib/server-auth'

/**
 * Whether the server requires an OAuth sign-in before the Web UI connects.
 * The WebSocket upgrade is refused without a session, so the bridge must not
 * start until this resolves to `disabled` or `signed-in`.
 */
export const useServerAuthStore = defineStore('server-auth', () => {
  const status = ref<ServerAuthStatus | 'unknown'>(IS_CORE_MODE ? 'disabled' : 'unknown')
  let pending: Promise<ServerAuthStatus> | undefined

  function check(): Promise<ServerAuthStatus> {
    if (status.value !== 'unknown')
      return Promise.resolve(status.value)
    pending ??= getServerAuthStatus()
      .catch((error) => {
        // An unreachable server is reported by the WebSocket bridge; do not block the UI on it here.
        useLogger('server-auth').withError(error).warn('Failed to read the server sign-in state')
        return 'disabled' as const
      })
      .then((resolved) => {
        status.value = resolved
        return resolved
      })
      .finally(() => {
        pending = undefined
      })
    return pending
  }

  return { status, check }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useServerAuthStore, import.meta.hot))
