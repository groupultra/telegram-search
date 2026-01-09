import type { Logger } from '@guiiai/logg'

import type { CoreContext } from '../context'

import { Api } from 'telegram'

import { accountModels } from '../models/accounts'

export function createSyncService(
  ctx: CoreContext,
  logger: Logger,
) {
  logger = logger.withContext('core:sync:service')

  let isSyncing = false

  /**
   * Performs a catch-up sync using Telegram's state machine.
   * This is called on reconnect or startup to fill gaps.
   */
  async function catchUp() {
    if (isSyncing) {
      logger.verbose('Sync already in progress, skipping')
      return
    }

    isSyncing = true
    try {
      const client = ctx.getClient()
      const accountId = ctx.getCurrentAccountId()
      const db = ctx.getDB()

      const account = (await accountModels.findAccountByUUID(db, accountId)).orUndefined()
      if (!account) {
        logger.error('Failed to find account for sync')
        return
      }

      // Get current server state to know the target
      const serverState = await client.invoke(new Api.updates.GetState())

      logger.withFields({
        pts: serverState.pts,
        qts: serverState.qts,
        seq: serverState.seq,
        date: serverState.date,
      }).log('Server state')

      // If we don't have a valid sequence date, bootstrap from current server state
      if (account.date === 0) {
        logger.log('Bootstrapping account state from Telegram (First sync)')
        await accountModels.updateAccountState(db, accountId, {
          pts: serverState.pts,
          qts: serverState.qts,
          seq: serverState.seq,
          date: serverState.date,
          lastSyncAt: Date.now(),
        })
        logger.withFields({ pts: serverState.pts, qts: serverState.qts }).log('Account state bootstrapped')
        return
      }

      const targetPts = serverState.pts
      if (account.pts >= targetPts) {
        logger.verbose('Account is already up to date', { pts: account.pts })
        return
      }

      logger.withFields({
        currentPts: account.pts,
        targetPts,
        gap: targetPts - account.pts,
      }).log('Starting catch-up sync')

      ctx.emitter.emit('sync:status', { status: 'syncing' })

      let currentPts = account.pts
      let currentQts = account.qts
      let currentSeq = account.seq
      let currentDate = account.date

      while (currentPts < targetPts) {
        const difference = await client.invoke(
          new Api.updates.GetDifference({
            pts: currentPts,
            qts: currentQts,
            date: currentDate,
          }),
        )

        if (difference instanceof Api.updates.DifferenceEmpty) {
          logger.verbose('Sync complete: No differences')
          break
        }

        if (difference instanceof Api.updates.DifferenceTooLong) {
          logger.warn('Sync gap too large (DifferenceTooLong). Updating state and falling back to takeout.')

          // Update state to current server state to avoid infinite loop of DifferenceTooLong
          await accountModels.updateAccountState(db, accountId, {
            pts: targetPts,
            qts: serverState.qts,
            seq: serverState.seq,
            date: serverState.date,
            lastSyncAt: Date.now(),
          })

          ctx.emitter.emit('takeout:run', { chatIds: [], increase: true, syncOptions: {} })
          break
        }

        // Handle entities (users and chats)
        const users = 'users' in difference ? difference.users : []
        const chats = 'chats' in difference ? difference.chats : []
        if (users.length > 0 || chats.length > 0) {
          ctx.emitter.emit('entity:process', { users, chats })
        }

        // Handle messages
        const messages = 'newMessages' in difference ? difference.newMessages : []
        const validMessages = messages.filter((m): m is Api.Message => m instanceof Api.Message)

        if (validMessages.length > 0) {
          const progress = Math.min(100, Math.round((currentPts / targetPts) * 100))
          logger.withFields({
            count: validMessages.length,
            pts: currentPts,
            progress: `${progress}%`,
          }).log('Syncing messages batch (Text only)')

          ctx.emitter.emit('message:process', {
            messages: validMessages,
            isTakeout: false,
            // Skip expensive side-effects during massive catch-up to avoid bans
            syncOptions: {
              skipMedia: true,
              skipEmbedding: true,
              skipJieba: true,
            },
          })

          // Faster throttle since we are skipping media
          await new Promise(resolve => setTimeout(resolve, 20))
        }

        const nextState = 'state' in difference ? difference.state : 'intermediateState' in difference ? difference.intermediateState : undefined
        if (nextState) {
          if (nextState.pts === currentPts && nextState.qts === currentQts && nextState.seq === currentSeq) {
            logger.warn('Sync state stagnated, breaking loop')
            break
          }

          currentPts = nextState.pts
          currentQts = nextState.qts
          currentSeq = nextState.seq
          currentDate = nextState.date

          await accountModels.updateAccountState(db, accountId, {
            pts: currentPts,
            qts: currentQts,
            seq: currentSeq,
            date: currentDate,
            lastSyncAt: Date.now(),
          })
        }
        else {
          break
        }

        if (difference instanceof Api.updates.Difference) {
          break
        }
      }

      ctx.emitter.emit('sync:status', { status: 'idle' })
      logger.log('Sync process finished', { finalPts: currentPts })
    }
    catch (error) {
      ctx.withError(error, 'Catch-up sync failed')
      ctx.emitter.emit('sync:status', { status: 'error' })
    }
    finally {
      isSyncing = false
    }
  }

  /**
   * Resets the sync state to zero.
   */
  async function reset() {
    const db = ctx.getDB()
    const accountId = ctx.getCurrentAccountId()
    await accountModels.forceUpdateAccountState(db, accountId, {
      pts: 0,
      qts: 0,
      seq: 0,
      date: 0,
      lastSyncAt: 0,
    })
  }

  return {
    catchUp,
    reset,
  }
}

export type SyncService = ReturnType<typeof createSyncService>
