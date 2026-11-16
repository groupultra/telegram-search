import type { ServerAuthStatus } from '../lib/server-auth'

import { useLogger } from '@guiiai/logg'
import { useBridge } from '@tg-search/client'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'

import { IS_CORE_MODE } from '../constants'
import { exchangeSignInTicket, getServerAuthStatus, takePendingSignIn } from '../lib/server-auth'

/** What the caller should do after a completed sign-in. */
export type SignInOutcome
  = | { kind: 'navigate', url: string } // leave the app: consent page or the OAuth client
    | { kind: 'route', path: string } // continue inside the app
    | { kind: 'done' }

/**
 * Sign-in state for a server running with OAuth (`TGS_AUTH=oauth`). Logging in
 * to Telegram is the sign-in: once the Telegram account is ready, the bridge
 * asks the server for a ticket and exchanges it for a session cookie.
 */
export const useServerAuthStore = defineStore('server-auth', () => {
  const status = ref<ServerAuthStatus | 'unknown'>(IS_CORE_MODE ? 'disabled' : 'unknown')
  let pending: Promise<ServerAuthStatus> | undefined
  let signingIn: Promise<SignInOutcome> | undefined

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

  async function requestTicket(): Promise<string> {
    const bridge = useBridge()
    const response = bridge.waitForEvent('server:sign-in-ticket')
    bridge.sendEvent('server:sign-in-ticket')
    const result = await response
    if ('error' in result)
      throw new Error(`The server did not issue a sign-in ticket: ${result.error}`)
    return result.ticket
  }

  /**
   * Signs in to the server with the Telegram account the bridge is logged in
   * to, then continues where the sign-in was requested. Call only once the
   * account is ready; concurrent calls share one attempt.
   */
  function completeSignIn(): Promise<SignInOutcome> {
    signingIn ??= (async () => {
      const ticket = await requestTicket()
      const next = takePendingSignIn()
      const { redirectUrl } = await exchangeSignInTicket(ticket, next.oauthQuery)
      status.value = 'signed-in'
      if (redirectUrl)
        return { kind: 'navigate', url: redirectUrl } as const
      return next.redirect ? { kind: 'route', path: next.redirect } as const : { kind: 'done' } as const
    })().finally(() => {
      signingIn = undefined
    })
    return signingIn
  }

  return { status, check, completeSignIn }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useServerAuthStore, import.meta.hot))
