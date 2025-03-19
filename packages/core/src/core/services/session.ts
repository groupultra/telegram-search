import type { CoreEmitter } from '../client'
import type { PromiseResult } from '../utils/result'

import fs from 'node:fs/promises'
import path from 'node:path'
import { getConfig, useLogger } from '@tg-search/common'
import { StringSession } from 'telegram/sessions'

import { withResult } from '../utils/result'

export function createSessionService(
  emitter: CoreEmitter,
) {
  const logger = useLogger()
  const config = getConfig()

  const sessionFile = path.join(config.path.session, 'session.json')

  emitter.on('auth:logout', () => {
    void cleanSession()
  })

  async function cleanSession() {
    try {
      await fs.unlink(sessionFile)
      logger.withFields({ sessionFile }).debug('Deleted session file')
      return withResult(null, null)
    }
    catch (error) {
      logger.withError(error).error('Failed to delete session file')
      return withResult(null, error)
    }
  }

  return {
    loadSession: async (): PromiseResult<StringSession | null> => {
      logger.withFields({ sessionFile }).debug('Loading session from file')

      try {
        await fs.mkdir(path.dirname(sessionFile), { recursive: true })
        const session = await fs.readFile(sessionFile, 'utf-8')
        return withResult(new StringSession(session), null)
      }
      catch (error) {
        logger.withError(error).error('Failed to load session from file')
        return withResult(null, error)
      }
    },

    saveSession: async (session: StringSession) => {
      try {
        await fs.mkdir(path.dirname(sessionFile), { recursive: true })
        await fs.writeFile(sessionFile, session.save(), 'utf-8')
        logger.withFields({ sessionFile }).debug('Saving session to file')
        return withResult(null, null)
      }
      catch (error) {
        logger.withError(error).error('Failed to save session to file')
        return withResult(null, error)
      }
    },

    cleanSession,
  }
}
