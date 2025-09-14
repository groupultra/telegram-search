import type { Result } from '@unbird/result'

import type { CoreContext } from '../context'

import fs from 'node:fs/promises'

import { getSessionPath } from '@tg-search/common/node'
import { useLogger } from '@unbird/logg'
import { Err, Ok } from '@unbird/result'
import { dirname, join } from 'pathe'
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

  function getSessionFilePath(phoneNumber: string) {
    const sessionPath = getSessionPath()
    return join(sessionPath, `${phoneNumber.replace('+', '')}.session`)
  }

  async function cleanSession(phoneNumber: string) {
    const sessionFilePath = getSessionFilePath(phoneNumber)

    try {
      await fs.unlink(sessionFilePath)
      logger.withFields({ sessionFile: sessionFilePath, phoneNumber }).verbose('Deleted session file')
      return Ok(null)
    }
    catch (error) {
      return Err(withError(error, 'Failed to delete session file'))
    }
  }

  return {
    loadSession: async (phoneNumber: string): Promise<Result<StringSession>> => {
      const sessionFilePath = getSessionFilePath(phoneNumber)

      logger.withFields({ sessionFilePath, phoneNumber }).verbose('Loading session from file')

      try {
        // Ensure session directory exists
        await fs.mkdir(dirname(sessionFilePath), { recursive: true })

        try {
          const session = await fs.readFile(sessionFilePath, 'utf-8')
          return Ok(new StringSession(session))
        }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            // Return empty session for first time use when no session exists
            return Ok(new StringSession())
          }
          return Err(withError(error, 'Failed to load session from file'))
        }
      }
      catch (error) {
        return Err(withError(error, 'Failed to create session directory'))
      }
    },

    saveSession: async (phoneNumber: string, session: string) => {
      const sessionFilePath = getSessionFilePath(phoneNumber)

      try {
        try {
          await fs.access(dirname(sessionFilePath))
        }
        catch {
          await fs.mkdir(dirname(sessionFilePath), { recursive: true })
        }

        await fs.writeFile(sessionFilePath, session, 'utf-8')
        logger.withFields({ sessionFilePath, phoneNumber }).verbose('Saving session to file')
        return Ok(null)
      }
      catch (error) {
        return Err(withError(error, 'Failed to save session to file'))
      }
    },

    cleanSession,
  }
}
