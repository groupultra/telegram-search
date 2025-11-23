import type { Result } from '@unbird/result'

import type { CoreContext } from '../context'

import { useLogger } from '@guiiai/logg'
import { Err, Ok } from '@unbird/result'
import { StringSession } from 'telegram/sessions'

export type SessionService = ReturnType<typeof createSessionService>

// TODO: use Api.SessionManager
export function createSessionService(ctx: CoreContext) {
  const { withError } = ctx

  const logger = useLogger()

  function getSessionKey(identifier: string) {
    // Support both phoneNumber and userId as identifier
    return `tg-session-${identifier.replace('+', '')}`
  }

  async function cleanSession(identifier: string) {
    const sessionKey = getSessionKey(identifier)

    try {
      localStorage.removeItem(sessionKey)
      logger.withFields({ sessionKey, identifier }).verbose('Deleted session from localStorage')
      return Ok(null)
    }
    catch (error) {
      return Err(withError(error, 'Failed to delete session from localStorage'))
    }
  }

  return {
    loadSession: async (identifier: string): Promise<Result<StringSession>> => {
      const sessionKey = getSessionKey(identifier)

      logger.withFields({ sessionKey, identifier }).verbose('Loading session from localStorage')

      try {
        const { useLocalStorage } = await import('@vueuse/core')
        const storage = useLocalStorage<string | null>(sessionKey, null)
        const session = storage.value

        if (!session) {
          // Return empty session for first time use when no session exists
          return Ok(new StringSession())
        }

        return Ok(new StringSession(session))
      }
      catch (error) {
        return Err(withError(error, 'Failed to load session from localStorage'))
      }
    },

    saveSession: async (identifier: string, session: string) => {
      const sessionKey = getSessionKey(identifier)

      try {
        const { useLocalStorage } = await import('@vueuse/core')
        const storage = useLocalStorage(sessionKey, session)
        storage.value = session
        logger.withFields({ sessionKey, identifier }).verbose('Saving session to localStorage')
        return Ok(null)
      }
      catch (error) {
        return Err(withError(error, 'Failed to save session to localStorage'))
      }
    },

    cleanSession,
  }
}
