import type { Logger } from '@guiiai/logg'
import type { CoreDB } from '@tg-search/core'

import { Buffer } from 'node:buffer'
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'

import { models } from '@tg-search/core'
import { maxLength, minLength, parse, pipe, strictObject, string } from 'valibot'

/**
 * Encrypted storage of the Telegram sessions the server holds, so it can
 * reconnect accounts after a restart.
 *
 * Threat model: protects sessions against a reader of the database or its
 * backups who does not have `BETTER_AUTH_SECRET`. The server process can
 * always decrypt them, because it connects to Telegram on the user's behalf.
 */

const PURPOSE = 'telegram-search:telegram-session-storage:v1'
const VERSION = 1
const NONCE_BYTES = 12
const TAG_BYTES = 16

const payloadSchema = strictObject({
  /** The Web UI's `sessionId`; the restored runtime keeps it so the browser reattaches instead of logging in twice. */
  runtimeKey: pipe(string(), minLength(1), maxLength(128)),
  session: pipe(string(), minLength(1), maxLength(8192)),
})

export interface StoredTelegramSession {
  accountId: string
  runtimeKey: string
  session: string
}

export interface TelegramSessionStore {
  save: (session: StoredTelegramSession) => Promise<void>
  remove: (accountId: string) => Promise<void>
  /** Returns every session that decrypts; rows sealed with another secret are skipped and logged. */
  loadAll: () => Promise<StoredTelegramSession[]>
}

export function createTelegramSessionStore(options: { db: CoreDB, secret: string, logger: Logger }): TelegramSessionStore {
  const { db, logger } = options
  // A key of its own: the media-link and Better Auth keys never decrypt sessions.
  const key = Buffer.from(hkdfSync('sha256', options.secret, '', PURPOSE, 32))
  // Binding the account ID stops a database writer from moving one account's session onto another account's row.
  const aad = (accountId: string) => Buffer.from(`${PURPOSE}:${accountId}`)

  function seal(accountId: string, payload: { runtimeKey: string, session: string }): string {
    const nonce = randomBytes(NONCE_BYTES)
    const cipher = createCipheriv('aes-256-gcm', key, nonce)
    cipher.setAAD(aad(accountId))
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()])
    return Buffer.concat([Buffer.from([VERSION]), nonce, cipher.getAuthTag(), encrypted]).toString('base64url')
  }

  function open(accountId: string, ciphertext: string) {
    const bytes = Buffer.from(ciphertext, 'base64url')
    if (bytes.length <= 1 + NONCE_BYTES + TAG_BYTES || bytes[0] !== VERSION)
      throw new Error('Unsupported session ciphertext')
    const nonce = bytes.subarray(1, 1 + NONCE_BYTES)
    const tag = bytes.subarray(1 + NONCE_BYTES, 1 + NONCE_BYTES + TAG_BYTES)
    const decipher = createDecipheriv('aes-256-gcm', key, nonce)
    decipher.setAAD(aad(accountId))
    decipher.setAuthTag(tag)
    const plaintext = Buffer.concat([decipher.update(bytes.subarray(1 + NONCE_BYTES + TAG_BYTES)), decipher.final()]).toString('utf8')
    return parse(payloadSchema, JSON.parse(plaintext))
  }

  const sessionModels = models.accountTelegramSessionModels

  return {
    async save({ accountId, runtimeKey, session }) {
      const ciphertext = seal(accountId, parse(payloadSchema, { runtimeKey, session }))
      ;(await sessionModels.upsertSession(db, { accountId, ciphertext })).expect('Failed to store the Telegram session')
    },

    async remove(accountId) {
      (await sessionModels.deleteSession(db, accountId)).expect('Failed to delete the stored Telegram session')
    },

    async loadAll() {
      const rows = (await sessionModels.listSessions(db)).expect('Failed to list stored Telegram sessions')
      const sessions: StoredTelegramSession[] = []
      for (const row of rows) {
        try {
          sessions.push({ accountId: row.accountId, ...open(row.accountId, row.ciphertext) })
        }
        catch (error) {
          // Kept, not deleted: a rotated secret can be rolled back. The next login on this account overwrites the row.
          logger.withFields({ accountId: row.accountId }).withError(error).warn('Skipping a stored Telegram session that does not decrypt')
        }
      }
      return sessions
    },
  }
}
