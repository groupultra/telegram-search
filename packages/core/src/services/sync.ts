import type { Logger } from '@guiiai/logg'

import type { CoreContext } from '../context'
import type { DBSelectAccount } from '../models/utils/types'

import bigInt from 'big-integer'

import { Api } from 'telegram'
import { v4 as uuidv4 } from 'uuid'

import { accountModels } from '../models/accounts'
import { chatMessageModels } from '../models/chat-message'
import { chatModels } from '../models/chats'
import { CoreEventType } from '../types/events'

const MESSAGE_PROCESS_TIMEOUT_MS = 60_000
const CHANNEL_DIFFERENCE_LIMIT = 100

export function createSyncService(ctx: CoreContext, logger: Logger) {
  logger = logger.withContext('core:sync:service')
  let isSyncing = false

  function messageKey(message: Api.Message): string {
    const peer = message.peerId
    if (peer instanceof Api.PeerChannel)
      return `channel:${peer.channelId}:${message.id}`
    if (peer instanceof Api.PeerChat)
      return `chat:${peer.chatId}:${message.id}`
    if (peer instanceof Api.PeerUser)
      return `user:${peer.userId}:${message.id}`
    return `unknown:${message.id}`
  }

  function chatIdFromMessage(message: Api.Message): string | undefined {
    const peer = message.peerId
    if (peer instanceof Api.PeerChannel)
      return peer.channelId.toString()
    if (peer instanceof Api.PeerChat)
      return peer.chatId.toString()
    if (peer instanceof Api.PeerUser)
      return peer.userId.toString()
    return undefined
  }

  async function persistMessages(messages: Api.Message[]): Promise<void> {
    if (messages.length === 0)
      return

    const batchId = `catch-up-${uuidv4()}`
    await new Promise<void>((resolve, reject) => {
      let timeout: ReturnType<typeof setTimeout>
      let onProcessed: (data: { batchId: string }) => void
      let onFailed: (data: { batchId: string, error: string }) => void
      const cleanup = () => {
        clearTimeout(timeout)
        ctx.emitter.off(CoreEventType.MessageProcessed, onProcessed)
        ctx.emitter.off(CoreEventType.MessageProcessFailed, onFailed)
      }
      onProcessed = (data) => {
        if (data.batchId !== batchId)
          return
        cleanup()
        resolve()
      }
      onFailed = (data) => {
        if (data.batchId !== batchId)
          return
        cleanup()
        reject(new Error(data.error))
      }
      timeout = setTimeout(() => {
        cleanup()
        reject(new Error(`Timed out persisting catch-up batch ${batchId}`))
      }, MESSAGE_PROCESS_TIMEOUT_MS)

      ctx.emitter.on(CoreEventType.MessageProcessed, onProcessed)
      ctx.emitter.on(CoreEventType.MessageProcessFailed, onFailed)
      ctx.emitter.emit(CoreEventType.MessageProcess, {
        messages,
        isTakeout: false,
        batchId,
        syncOptions: {
          skipMedia: true,
          skipEmbedding: true,
          skipJieba: true,
        },
      })
    })
  }

  async function applyRecoveredUpdates(
    accountId: string,
    newMessages: Api.TypeMessage[],
    otherUpdates: Api.TypeUpdate[],
  ): Promise<void> {
    const messages = new Map<string, Api.Message>()
    const editedMessages: Api.Message[] = []

    for (const message of newMessages) {
      if (message instanceof Api.Message)
        messages.set(messageKey(message), message)
    }

    for (const update of otherUpdates) {
      if (update instanceof Api.UpdateNewMessage || update instanceof Api.UpdateNewChannelMessage) {
        if (update.message instanceof Api.Message)
          messages.set(messageKey(update.message), update.message)
      }
      else if (update instanceof Api.UpdateEditMessage || update instanceof Api.UpdateEditChannelMessage) {
        if (update.message instanceof Api.Message) {
          messages.set(messageKey(update.message), update.message)
          editedMessages.push(update.message)
        }
      }
    }

    await persistMessages([...messages.values()])

    for (const message of editedMessages) {
      const chatId = chatIdFromMessage(message)
      if (chatId) {
        ctx.emitter.emit(CoreEventType.MessageUpdated, {
          chatId,
          messageId: message.id.toString(),
        })
      }
    }

    for (const update of otherUpdates) {
      if (update instanceof Api.UpdateDeleteMessages) {
        const messageIds = update.messages.map(String)
        await chatMessageModels.softDeleteMessages(ctx.getDB(), accountId, messageIds)
        ctx.emitter.emit(CoreEventType.MessageDeleted, { messageIds })
      }
      else if (update instanceof Api.UpdateDeleteChannelMessages) {
        const chatId = update.channelId.toString()
        const messageIds = update.messages.map(String)
        await chatMessageModels.softDeleteMessages(ctx.getDB(), accountId, messageIds, { chatId })
        ctx.emitter.emit(CoreEventType.MessageDeleted, { chatId, messageIds })
      }
    }
  }

  async function catchUpAccount(accountId: string, account: DBSelectAccount): Promise<void> {
    const client = ctx.getClient()
    const db = ctx.getDB()
    const serverState = await client.invoke(new Api.updates.GetState())

    logger.withFields({
      pts: serverState.pts,
      qts: serverState.qts,
      seq: serverState.seq,
      date: serverState.date,
    }).log('Server state')

    if (account.date === 0) {
      logger.log('Bootstrapping account state from Telegram (First sync)')
      await accountModels.updateAccountState(db, accountId, {
        pts: serverState.pts,
        qts: serverState.qts,
        seq: serverState.seq,
        date: serverState.date,
        lastSyncAt: Date.now(),
      })
      return
    }

    const targetPts = serverState.pts
    if (account.pts >= targetPts) {
      logger.verbose('Account is already up to date', { pts: account.pts })
      return
    }

    let currentPts = account.pts
    let currentQts = account.qts
    let currentSeq = account.seq
    let currentDate = account.date

    while (currentPts < targetPts) {
      const difference = await client.invoke(new Api.updates.GetDifference({
        pts: currentPts,
        qts: currentQts,
        date: currentDate,
      }))

      if (difference instanceof Api.updates.DifferenceEmpty) {
        logger.verbose('Account difference is empty')
        break
      }
      if (difference instanceof Api.updates.DifferenceTooLong) {
        throw new TypeError('Account gap is too large for GetDifference; checkpoint preserved until an explicit Takeout sync completes')
      }

      if (difference.users.length > 0 || difference.chats.length > 0) {
        ctx.emitter.emit(CoreEventType.EntityProcess, {
          users: difference.users,
          chats: difference.chats,
        })
      }
      await applyRecoveredUpdates(accountId, difference.newMessages, difference.otherUpdates)

      const nextState = difference instanceof Api.updates.Difference
        ? difference.state
        : difference.intermediateState
      if (nextState.pts === currentPts && nextState.qts === currentQts && nextState.seq === currentSeq)
        throw new Error('Account catch-up state did not advance')

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

      if (difference instanceof Api.updates.Difference)
        break
    }
  }

  async function catchUpChannels(accountId: string): Promise<void> {
    const client = ctx.getClient()
    const channels = (await chatModels.fetchChatsByAccountId(ctx.getDB(), accountId))
      .expect('Failed to load channel checkpoints')
      .filter(chat => (chat.chat_type === 'channel' || chat.chat_type === 'supergroup') && chat.access_hash && chat.pts > 0)

    for (const chat of channels) {
      const channel = new Api.InputChannel({
        channelId: bigInt(chat.chat_id),
        accessHash: bigInt(chat.access_hash!),
      })
      let currentPts = chat.pts

      while (true) {
        const difference = await client.invoke(new Api.updates.GetChannelDifference({
          channel,
          filter: new Api.ChannelMessagesFilterEmpty(),
          pts: currentPts,
          limit: CHANNEL_DIFFERENCE_LIMIT,
          force: true,
        }))

        if (difference instanceof Api.updates.ChannelDifferenceTooLong) {
          throw new TypeError(`Channel ${chat.chat_id} gap is too large; checkpoint preserved until an explicit Takeout sync completes`)
        }
        if (difference instanceof Api.updates.ChannelDifferenceEmpty) {
          await chatModels.updateChatPts(ctx.getDB(), accountId, chat.chat_id, difference.pts)
          if (difference.final || difference.pts === currentPts)
            break
          currentPts = difference.pts
          continue
        }

        if (difference.users.length > 0 || difference.chats.length > 0) {
          ctx.emitter.emit(CoreEventType.EntityProcess, {
            users: difference.users,
            chats: difference.chats,
          })
        }
        await applyRecoveredUpdates(accountId, difference.newMessages, difference.otherUpdates)

        if (difference.pts === currentPts)
          throw new Error(`Channel ${chat.chat_id} catch-up state did not advance`)
        currentPts = difference.pts
        await chatModels.updateChatPts(ctx.getDB(), accountId, chat.chat_id, currentPts)
        if (difference.final)
          break
      }
    }
  }

  /**
   * Recover account and channel gaps. Checkpoints move only after recovered
   * mutations are persisted, so a failed write or crash remains retryable.
   */
  async function catchUp() {
    if (isSyncing) {
      logger.verbose('Sync already in progress, skipping')
      return
    }

    isSyncing = true
    ctx.emitter.emit(CoreEventType.SyncStatus, { status: 'syncing' })
    try {
      const accountId = ctx.getCurrentAccountId()
      const account = (await accountModels.findAccountByUUID(ctx.getDB(), accountId)).orUndefined()
      if (!account)
        throw new Error('Failed to find account for sync')

      await catchUpAccount(accountId, account)
      await catchUpChannels(accountId)
      ctx.emitter.emit(CoreEventType.SyncStatus, { status: 'idle' })
      logger.log('Sync process finished')
    }
    catch (error) {
      ctx.withError(error, 'Catch-up sync failed')
      ctx.emitter.emit(CoreEventType.SyncStatus, { status: 'error' })
    }
    finally {
      isSyncing = false
    }
  }

  async function reset() {
    await accountModels.forceUpdateAccountState(ctx.getDB(), ctx.getCurrentAccountId(), {
      pts: 0,
      qts: 0,
      seq: 0,
      date: 0,
      lastSyncAt: 0,
    })
  }

  return { catchUp, reset }
}

export type SyncService = ReturnType<typeof createSyncService>
