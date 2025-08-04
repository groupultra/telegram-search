import type { Result } from '@unbird/result'

import type { CoreContext } from '../context'

import { access, mkdir, readFile, unlink, writeFile } from 'node:fs/promises'

import { useLogger } from '@unbird/logg'
import { Err, Ok } from '@unbird/result'
import path from 'pathe'
import { StringSession } from 'telegram/sessions'

import { getSessionPath, useConfig } from '../../../common/src/node'

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
    const config = useConfig()
    const sessionPath = getSessionPath(config.path.storage)

    return path.join(sessionPath, `${phoneNumber.replace('+', '')}.session`)
  }

  async function cleanSession(phoneNumber: string) {
    const sessionFilePath = getSessionFilePath(phoneNumber)

    try {
      await unlink(sessionFilePath)
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
        await mkdir(path.dirname(sessionFilePath), { recursive: true })

        try {
          const session = await readFile(sessionFilePath, 'utf-8')
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
          await access(path.dirname(sessionFilePath))
        }
        catch {
          await mkdir(path.dirname(sessionFilePath), { recursive: true })
        }

        await writeFile(sessionFilePath, session, 'utf-8')
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
