import type { CorePagination } from '@tg-search/common/utils/pagination'
import type { Result } from '@unbird/result'
import type { EntityLike } from 'telegram/define'

import type { CoreContext } from '../context'
import type { CoreTask } from '../utils/task'

import { useLogger } from '@unbird/logg'
import { Err, Ok } from '@unbird/result'
import bigInt from 'big-integer'
import { Api } from 'telegram'

import { useTasks } from '../utils/task'

export interface TakeoutTaskMetadata {
  chatIds: string[]
}

export interface TakeoutEventToCore {
  'takeout:run': (data: { chatIds: string[], increase?: boolean }) => void
  'takeout:task:abort': (data: { taskId: string }) => void
}

export interface TakeoutEventFromCore {
  'takeout:task:progress': (data: CoreTask<'takeout'>) => void
}

export type TakeoutEvent = TakeoutEventFromCore & TakeoutEventToCore

export interface TakeoutOpts {
  chatId: string
  pagination: CorePagination

  startTime?: Date
  endTime?: Date

  // Filter
  skipMedia?: boolean
  messageTypes?: string[]

  // Incremental export
  minId?: number
  maxId?: number
}

export type TakeoutService = ReturnType<typeof createTakeoutService>

// https://core.telegram.org/api/takeout
export function createTakeoutService(ctx: CoreContext) {
  const { emitter, withError, getClient } = ctx

  const logger = useLogger()

  const { createTask, updateTaskProgress, updateTaskError, abortTask } = useTasks('takeout')

  const emitProgress = (taskId: string, progress: number, message?: string) => {
    emitter.emit('takeout:task:progress', updateTaskProgress(taskId, progress, message))
  }

  const emitError = (taskId: string, error: Error) => {
    logger.withError(error).error('Takeout task error')
    emitter.emit('takeout:task:progress', updateTaskError(taskId, error))
  }

  async function initTakeout(): Promise<Result<Api.account.Takeout>> {
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

      return Ok(takeout)
    }
    catch (error) {
      return Err(withError(error, 'Init takeout session failed'))
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

      return Ok(null)
    }
    catch (error) {
      return Err(withError(error, 'Finish takeout session failed'))
    }
  }

  async function getHistoryWithMessagesCount(chatId: EntityLike): Promise<Result<Api.messages.TypeMessages & { count: number }>> {
    try {
      const history = await getClient()
        .invoke(new Api.messages.GetHistory({
          peer: chatId,
          limit: 1,
          offsetId: 0,
          offsetDate: 0,
          addOffset: 0,
          maxId: 0,
          minId: 0,
          hash: bigInt(0),
        })) as Api.messages.TypeMessages & { count: number }

      return Ok(history)
    }
    catch (error) {
      return Err(withError(error, 'Failed to get history'))
    }
  }

  async function* takeoutMessages(
    chatId: string,
    options: Omit<TakeoutOpts, 'chatId'>,
  ): AsyncGenerator<Api.Message> {
    const { taskId, abortController } = createTask({
      chatIds: [chatId],
    })

    emitProgress(taskId, 0, 'Init takeout session')

    let offsetId = options.pagination.offset
    let hasMore = true
    let processedCount = 0

    const limit = options.pagination.limit
    const minId = options.minId
    const maxId = options.maxId

    const takeoutSession = (await initTakeout()).expect('Init takeout session failed')

    emitProgress(taskId, 0, 'Get messages')

    const { count } = (await getHistoryWithMessagesCount(chatId)).expect('Failed to get history')

    try {
      while (hasMore && !abortController.signal.aborted) {
        // https://core.telegram.org/api/offsets#hash-generation
        const id = BigInt(chatId)
        const hashBigInt = id ^ (id >> 21n) ^ (id << 35n) ^ (id >> 4n) + id
        const hash = bigInt(hashBigInt.toString())

        const peer = await getClient().getInputEntity(chatId)
        const historyQuery = new Api.messages.GetHistory({
          peer,
          offsetId,
          addOffset: 0,
          offsetDate: 0,
          limit,
          maxId,
          minId,
          hash,
        })

        logger.withFields(historyQuery).verbose('Historical messages query')

        const result = await getClient().invoke(
          new Api.InvokeWithTakeout({
            takeoutId: takeoutSession.id,
            query: historyQuery,
          }),
        ) as unknown as Api.messages.MessagesSlice

        // Type safe check
        if ('messages' in result && result.messages.length === 0) {
          emitError(taskId, new Error('Get messages failed or returned empty data'))
          break
        }

        const messages = result.messages as Api.Message[]

        // If we got fewer messages than requested, there are no more
        hasMore = messages.length === limit

        logger.withFields({ count: messages.length }).debug('Got messages batch')

        for (const message of messages) {
          if (abortController.signal.aborted) {
            break
          }

          // Skip empty messages
          if (message instanceof Api.MessageEmpty) {
            continue
          }

          processedCount++
          yield message
        }

        offsetId = messages[messages.length - 1].id

        emitter.emit(
          'takeout:task:progress',
          updateTaskProgress(
            taskId,
            Number((processedCount / count).toFixed(2)),
            `Processed ${processedCount}/${count} messages`,
          ),
        )
      }

      await finishTakeout(takeoutSession, true)

      if (abortController.signal.aborted) {
        emitError(taskId, new Error('Task aborted'))
        return
      }

      emitProgress(taskId, 100)
      logger.withFields({ taskId }).verbose('Takeout messages finished')
    }
    catch (error) {
      logger.withError(error).error('Takeout messages failed')

      // TODO: error handler
      await finishTakeout(takeoutSession, false)
      emitError(taskId, new Error('Takeout messages failed'))
    }
  }

  return {
    takeoutMessages,
    abortTask,
  }
}
