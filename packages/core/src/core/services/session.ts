import type { CoreEmitter } from '../client'
import type { PromiseResult } from '../utils/result'

import fs from 'node:fs/promises'
import path from 'node:path'
import { getConfig, useLogger } from '@tg-search/common'
import { StringSession } from 'telegram/sessions'

import { withResult } from '../utils/result'

export function createSessionService(_emitter: CoreEmitter) {
  const logger = useLogger()

  async function cleanSession() {
    const config = getConfig()
    const sessionFile = config.path.session

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
      const config = getConfig()
      const sessionFile = config.path.session

      logger.withFields({ sessionFile }).debug('Loading session from file')

      try {
        // Check if the directory exists before reading the file
        try {
          await fs.access(path.dirname(sessionFile))
        }
        catch {
          await fs.mkdir(path.dirname(sessionFile), { recursive: true })
          // Return null for first time use when no session exists
          return withResult(null, null)
        }

        const session = await fs.readFile(sessionFile, 'utf-8')
        return withResult(new StringSession(session), null)
      }
      catch (error) {
        logger.withError(error).error('Failed to load session from file')
        return withResult(null, error)
      }
    },

    saveSession: async (session: StringSession) => {
      const config = getConfig()
      const sessionFile = config.path.session

      try {
        try {
          await fs.access(path.dirname(sessionFile))
        }
        catch {
          await fs.mkdir(path.dirname(sessionFile), { recursive: true })
        }

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
