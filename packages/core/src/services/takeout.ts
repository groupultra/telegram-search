import type { Result } from '@unbird/result'
import type { EntityLike } from 'telegram/define'

import type { CoreContext } from '../context'
import type { TakeoutOpts } from '../types/events'

import bigInt from 'big-integer'

import { useLogger } from '@guiiai/logg'
import { Err, Ok } from '@unbird/result'
import { Api } from 'telegram'

import { TELEGRAM_HISTORY_INTERVAL_MS } from '../constants'
import { createMinIntervalWaiter } from '../utils/min-interval'

export type TakeoutService = ReturnType<typeof createTakeoutService>

// https://core.telegram.org/api/takeout
export function createTakeoutService(ctx: CoreContext) {
  const { withError, getClient } = ctx

  const logger = useLogger()

  // Abortable min-interval waiter shared within this service
  const waitHistoryInterval = createMinIntervalWaiter(TELEGRAM_HISTORY_INTERVAL_MS)

  async function initTakeout() {
    const fileMaxSize = bigInt(1024 * 1024 * 1024) // 1GB

    // TODO: options
    return await getClient().invoke(new Api.account.InitTakeoutSession({
      contacts: true,
      messageUsers: true,
      messageChats: true,
      messageMegagroups: true,
      messageChannels: true,
      files: true,
      fileMaxSize,
    }))
  }

  async function finishTakeout(takeout: Api.account.Takeout, success: boolean) {
    await getClient().invoke(new Api.InvokeWithTakeout({
      takeoutId: takeout.id,
      query: new Api.account.FinishTakeoutSession({
        success,
      }),
    }))
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

  async function getTotalMessageCount(chatId: string): Promise<number> {
    try {
      const history = (await getHistoryWithMessagesCount(chatId)).expect('Failed to get history')
      return history.count ?? 0
    }
    catch (error) {
      logger.withError(error).error('Failed to get total message count')
      return 0
    }
  }

  async function* takeoutMessages(
    chatId: string,
    options: Omit<TakeoutOpts, 'chatId'>,
  ): AsyncGenerator<Api.Message> {
    const { task } = options

    task.updateProgress(0, 'Init takeout session')

    let offsetId = options.pagination.offset
    let hasMore = true
    let processedCount = 0

    const limit = options.pagination.limit
    const minId = options.minId
    const maxId = options.maxId

    let takeoutSession: Api.account.Takeout

    try {
      takeoutSession = await initTakeout()
    }
    catch (error) {
      task.updateError(withError(error, 'Init takeout session failed'))
      return
    }

    try {
      // Only emit initial progress if auto-progress is enabled
      if (!options.disableAutoProgress) {
        task.updateProgress(0, 'Get messages')
      }

      // Use provided expected count, or fetch from Telegram
      const count = options.expectedCount ?? (await getHistoryWithMessagesCount(chatId)).expect('Failed to get history').count

      logger.withFields({ expectedCount: count, providedCount: options.expectedCount }).verbose('Message count for progress')

      while (hasMore && !task.state.abortController.signal.aborted) {
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

        // Pace requests before invoking Telegram API; allow abort while waiting
        try {
          await waitHistoryInterval(task.state.abortController.signal)
        }
        catch {
          logger.verbose('Aborted during rate-limit wait')
          break
        }
        const result = await getClient().invoke(
          new Api.InvokeWithTakeout({
            takeoutId: takeoutSession.id,
            query: historyQuery,
          }),
        ) as unknown as Api.messages.MessagesSlice

        // Type safe check
        if (!('messages' in result)) {
          task.updateError(new Error('Invalid response format from Telegram API'))
          break
        }

        const messages = result.messages as Api.Message[]

        // If no messages returned, it means we've reached the boundary (no more messages to fetch)
        if (messages.length === 0) {
          logger.verbose('No more messages to fetch, reached boundary')
          break
        }

        // If we got fewer messages than requested, there are no more
        hasMore = messages.length === limit

        logger.withFields({ count: messages.length }).debug('Got messages batch')

        for (const message of messages) {
          if (task.state.abortController.signal.aborted) {
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

        // Only emit progress if auto-progress is enabled
        if (!options.disableAutoProgress) {
          task.updateProgress(
            Number(((processedCount / count) * 100).toFixed(2)),
            `Processed ${processedCount}/${count} messages`,
          )
        }

        logger.withFields({ processedCount, count }).verbose('Processed messages')
      }

      await finishTakeout(takeoutSession, true)

      if (task.state.abortController.signal.aborted) {
        // Task was aborted, handler layer already updated task status
        logger.withFields({ taskId: task.state.taskId }).verbose('Takeout messages aborted')
        return
      }

      // Only emit final progress if auto-progress is enabled
      if (!options.disableAutoProgress) {
        task.updateProgress(100)
      }
      logger.withFields({ taskId: task.state.taskId }).verbose('Takeout messages finished')
    }
    catch (error) {
      logger.withError(error).error('Takeout messages failed')

      // Preserve the original error for better error reporting
      const errorToEmit = error instanceof Error ? error : new Error('Takeout messages failed')

      await finishTakeout(takeoutSession, false)
      task.updateError(errorToEmit)
    }
  }

  return {
    takeoutMessages,
    getTotalMessageCount,
  }
}
