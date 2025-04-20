import type { TelegramMessageType } from '../../types'
import type { CoreContext } from '../context'
import type { PromiseResult } from '../utils/result'
import type { Task } from '../utils/task'

import { useLogger } from '@tg-search/common'
import bigInt from 'big-integer'
import { Api } from 'telegram'

import { withResult } from '../utils/result'
import { withRetry } from '../utils/retry'
import { useTasks } from '../utils/task'

export interface TakeoutTaskMetadata {
  chatIds: string[]
}

export interface TakeoutEventToCore {
  'takeout:run': (data: { chatIds: string[] }) => void

  // TODO: Abort signal & task manager
  'takeout:task:abort': (data: { taskId: string }) => void
}

export interface TakeoutEventFromCore {
  'takeout:task:progress': (data: Task<'takeout'>) => void
}

export type TakeoutEvent = TakeoutEventFromCore & TakeoutEventToCore

export interface TakeoutOpts {
  chatId: string
  limit?: number
  startTime?: Date
  endTime?: Date

  // Filter
  skipMedia?: boolean
  messageTypes?: TelegramMessageType[]

  // Incremental export
  minId?: number
  maxId?: number
}

// https://core.telegram.org/api/takeout
export function createTakeoutService(ctx: CoreContext) {
  const { emitter, withError, getClient } = ctx

  const logger = useLogger()

  const { createTask, updateTask } = useTasks('takeout')

  const emitProgress = (taskId: string, progress: number, message?: string) => {
    emitter.emit('takeout:task:progress', updateTask(taskId, {
      progress,
      lastMessage: message,
    }))
  }

  const emitError = (taskId: string, error: Error) => {
    emitter.emit('takeout:task:progress', updateTask(taskId, {
      progress: -1,
      lastError: error.message,
    }))
  }

  async function initTakeout(): PromiseResult<Api.account.Takeout | null> {
    const fileMaxSize = bigInt(1024 * 1024 * 1024) // 1GB

    try {
      // TODO: options
      const takeout = await getClient().invoke(new Api.account.InitTakeoutSession({
        contacts: true,
        messageUsers: true,
        messageChats: true,
        messageMegagroups: true,
        messageChannels: true,
        files: true,
        fileMaxSize,
      }))

      return withResult(takeout, null)
    }
    catch (error) {
      return withResult(null, withError(error, 'Init takeout session failed'))
    }
  }

  async function finishTakeout(takeout: Api.account.Takeout, success: boolean) {
    try {
      await getClient().invoke(new Api.InvokeWithTakeout({
        takeoutId: takeout.id,
        query: new Api.account.FinishTakeoutSession({
          success,
        }),
      }))

      return withResult(null, null)
    }
    catch (error) {
      return withResult(null, withError(error, 'Finish takeout session failed'))
    }
  }

  return {
    async* takeoutMessages(
      chatId: string,
      options: Omit<TakeoutOpts, 'chatId'>,
      // abortSignal: AbortSignal,
    ): AsyncGenerator<Api.Message> {
      const { taskId } = createTask({
        chatIds: [chatId],
      })

      emitProgress(taskId, 1, 'Init takeout session')

      let offsetId = 0
      let hasMore = true
      let processedCount = 0
      let hash: bigint = BigInt(0)

      const limit = options.limit || 100
      const minId = options.minId || 0
      const maxId = options.maxId || 0
      const startTime = options.startTime || new Date(0)
      const endTime = options.endTime || new Date()

      const { data: takeoutSession, error } = await initTakeout()
      if (takeoutSession === null || error) {
        // TODO: error handler
        logger.withError(error).error('Init takeout session failed')
        return
      }

      emitProgress(taskId, 2, 'Get messages')

      try {
        while (hasMore) {
          // https://core.telegram.org/api/offsets
          const id = BigInt(chatId)
          hash = hash ^ (hash >> 21n)
          hash = hash ^ (hash << 35n)
          hash = hash ^ (hash >> 4n)
          hash = hash + id

          // logger.debug(`get takeout message ${options?.minId}-${options?.maxId}`)

          const historyQuery = new Api.messages.GetHistory({
            peer: await getClient().getInputEntity(chatId),
            offsetId,
            addOffset: 0,
            limit,
            maxId,
            minId,
            hash: bigInt(hash.toString()),
          })

          logger.withFields({ historyQuery }).debug('message query')

          // emitter.emit('takeout:progress', {
          //   taskId: 'takeout',
          //   progress: 0,
          // })

          const result = await withRetry(async () => await getClient().invoke(
            new Api.InvokeWithTakeout({
              takeoutId: takeoutSession.id,
              query: historyQuery,
            }),
          )) as Record<string, unknown>

          // Type safe check
          if (result.length === 0 || !('messages' in result)) {
            logger.error('Get messages failed or returned empty data')
            return withResult(null, new Error('Get messages failed or returned empty data'))
          }

          const messages = result.messages as Api.Message[]

          // If we got fewer messages than requested, there are no more
          hasMore = messages.length === limit

          for (const message of messages) {
            // Skip empty messages
            if (message instanceof Api.MessageEmpty) {
              continue
            }

            // Check time range
            const messageTime = new Date(message.date * 1000)
            if (startTime && messageTime < startTime) {
              continue
            }
            if (endTime && messageTime > endTime) {
              continue
            }

            // Process message
            // emitter.emit('message:process', { message })

            // TODO: progress
            // emitter.emit('takeout:progress', {
            //   taskId: 'takeout',
            //   progress: processedCount / limit,
            // })

            yield message
            processedCount++

            // Update offsetId to current message ID
            offsetId = message.id

            // Check if we've reached the limit
            if (limit && processedCount >= limit) {
              return
            }
          }
        }

        await finishTakeout(takeoutSession, true)
        emitProgress(taskId, 100)
        logger.withFields({ taskId }).debug('Takeout messages finished')
      }
      catch (error) {
        logger.withError(error).error('Takeout messages failed')

        // TODO: error handler
        await finishTakeout(takeoutSession, false)
        emitError(taskId, new Error('Takeout messages failed'))
      }
    },
  }
}
