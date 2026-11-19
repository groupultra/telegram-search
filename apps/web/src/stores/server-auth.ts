import type { ServerAuthStatus } from '../lib/server-auth'

import { useLogger } from '@guiiai/logg'
import { useBridge } from '@tg-search/client'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'

import { IS_CORE_MODE } from '../constants'
import { exchangeSignInTicket, getServerAuthStatus } from '../lib/server-auth'

/** Where a completed sign-in continues: the next authorization step, or nowhere in particular. */
export type SignInOutcome = { kind: 'navigate', url: string } | { kind: 'done' }

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
    const result = await useBridge().requestSignInTicket()
    if ('error' in result)
      throw new Error(`The server did not issue a sign-in ticket: ${result.error}`)
    return result.ticket
  }

  /**
   * Signs in to the server with the Telegram account the bridge is logged in
   * to. With `oauthQuery` (the signed request on `/auth/sign-in`) the server
   * resumes that authorization request. Call only once the account is ready;
   * concurrent calls share one attempt.
   */
  function completeSignIn(oauthQuery?: string): Promise<SignInOutcome> {
    signingIn ??= (async () => {
      const ticket = await requestTicket()
      const { redirectUrl } = await exchangeSignInTicket(ticket, oauthQuery)
      status.value = 'signed-in'
      return redirectUrl ? { kind: 'navigate', url: redirectUrl } as const : { kind: 'done' } as const
    })().finally(() => {
      signingIn = undefined
    })
    return signingIn
  }

  return { status, check, completeSignIn }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useServerAuthStore, import.meta.hot))
