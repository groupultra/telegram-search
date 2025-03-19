import type { PromiseResult } from '../utils/result'

import fs from 'node:fs/promises'
import path from 'node:path'
import { getConfig, useLogger } from '@tg-search/common'
import { StringSession } from 'telegram/sessions'

import { result } from '../utils/result'

export function useSessionService() {
  const logger = useLogger()
  const config = getConfig()

  const sessionFile = path.join(config.path.session, 'session.json')

  return {
    loadSession: async (): PromiseResult<StringSession | null> => {
      logger.withFields({ sessionFile }).debug('Loading session from file')

      try {
        await fs.mkdir(path.dirname(sessionFile), { recursive: true })
        const session = await fs.readFile(sessionFile, 'utf-8')
        return result(new StringSession(session), null)
      }
      catch (error) {
        logger.withError(error).error('Failed to load session from file')
        return result(null, error)
      }
    },

    saveSession: async (session: StringSession) => {
      try {
        await fs.mkdir(path.dirname(sessionFile), { recursive: true })
        await fs.writeFile(sessionFile, session.save(), 'utf-8')
        logger.withFields({ sessionFile }).debug('Saving session to file')
        return result(null, null)
      }
      catch (error) {
        logger.withError(error).error('Failed to save session to file')
        return result(null, error)
      }
    },

    cleanSession: async () => {
      try {
        await fs.unlink(sessionFile)
        logger.withFields({ sessionFile }).debug('Clearing session')
        return result(null, null)
      }
      catch (error) {
        logger.withError(error).error('Failed to clear session')
        return result(null, error)
      }
    },
  }
}
