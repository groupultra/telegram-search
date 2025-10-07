import type { Result } from '@unbird/result'

import type { CoreContext } from '../context'

import { useLogger } from '@unbird/logg'
import { Err, Ok } from '@unbird/result'
import { StringSession } from 'telegram/sessions'

export interface SessionEventToCore {
  'session:update': (data: { phoneNumber: string, session: string }) => void
  'session:clean': (data: { phoneNumber: string }) => void
}

export interface SessionEventFromCore {}

export type SessionEvent = SessionEventFromCore & SessionEventToCore

export type SessionService = ReturnType<typeof createSessionService>

// TODO: use Api.SessionManager
export function createSessionService(ctx: CoreContext) {
  const { withError } = ctx

  const logger = useLogger()

  function getSessionKey(phoneNumber: string) {
    return `tg-session-${phoneNumber.replace('+', '')}`
  }

  async function cleanSession(phoneNumber: string) {
    const sessionKey = getSessionKey(phoneNumber)

    try {
      localStorage.removeItem(sessionKey)
      logger.withFields({ sessionKey, phoneNumber }).verbose('Deleted session from localStorage')
      return Ok(null)
    }
    catch (error) {
      return Err(withError(error, 'Failed to delete session from localStorage'))
    }
  }

  return {
    loadSession: async (phoneNumber: string): Promise<Result<StringSession>> => {
      const sessionKey = getSessionKey(phoneNumber)

      logger.withFields({ sessionKey, phoneNumber }).verbose('Loading session from localStorage')

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

    saveSession: async (phoneNumber: string, session: string) => {
      const sessionKey = getSessionKey(phoneNumber)

      try {
        const { useLocalStorage } = await import('@vueuse/core')
        const storage = useLocalStorage(sessionKey, session)
        storage.value = session
        logger.withFields({ sessionKey, phoneNumber }).verbose('Saving session to localStorage')
        return Ok(null)
      }
      catch (error) {
        return Err(withError(error, 'Failed to save session to localStorage'))
      }
    },

    cleanSession,
  }
}
