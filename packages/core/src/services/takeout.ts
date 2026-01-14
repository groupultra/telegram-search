import type { Logger } from '@guiiai/logg'
import type { Result } from '@unbird/result'
import type { EntityLike } from 'telegram/define'

import type { CoreContext } from '../context'
import type { ChatMessageStatsModels, ChatModels } from '../models'
import type { SyncOptions, TakeoutOpts } from '../types/events'

import bigInt from 'big-integer'

import { usePagination } from '@tg-search/common'
import { Err, Ok } from '@unbird/result'
import { Api } from 'telegram'

import { MESSAGE_PROCESS_BATCH_SIZE, TELEGRAM_HISTORY_INTERVAL_MS } from '../constants'
import { createMinIntervalWaiter } from '../utils/min-interval'
import { createTask } from '../utils/task'

export type TakeoutService = ReturnType<typeof createTakeoutService>

// https://core.telegram.org/api/takeout
export function createTakeoutService(
  ctx: CoreContext,
  logger: Logger,
  chatModels: ChatModels,
  chatMessageStatsModels: ChatMessageStatsModels,
) {
  logger = logger.withContext('core:takeout:service')

  // Store active tasks by taskId for abort handling
  const activeTasks = new Map<string, ReturnType<typeof createTask>>()

  // Abortable min-interval waiter shared within this service
  const waitHistoryInterval = createMinIntervalWaiter(TELEGRAM_HISTORY_INTERVAL_MS)

  async function initTakeout() {
    const fileMaxSize = bigInt(1024 * 1024 * 1024) // 1GB

    // TODO: options
    return await ctx.getClient().invoke(new Api.account.InitTakeoutSession({
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
    await ctx.getClient().invoke(new Api.InvokeWithTakeout({
      takeoutId: takeout.id,
      query: new Api.account.FinishTakeoutSession({
        success,
      }),
    }))
  }

  async function getHistoryWithMessagesCount(chatId: EntityLike): Promise<Result<Api.messages.TypeMessages & { count: number }>> {
    try {
      const history = await ctx.getClient()
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
      return Err(ctx.withError(error, 'Failed to get history'))
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
      task.updateError(ctx.withError(error, 'Init takeout session failed'))
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

        const peer = await ctx.getClient().getInputEntity(chatId)
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
        const result = await ctx.getClient().invoke(
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

  async function processMessageBatch(
    task: ReturnType<typeof createTask>,
    generator: AsyncGenerator<Api.Message>,
    syncOptions?: SyncOptions,
    onProcessed?: (count: number) => void,
    skipId?: number,
  ) {
    let messages: Api.Message[] = []
    let count = 0

    for await (const message of generator) {
      if (task.state.abortController.signal.aborted)
        break
      if (skipId && message.id === skipId)
        continue

      messages.push(message)
      count++

      if (messages.length >= MESSAGE_PROCESS_BATCH_SIZE) {
        if (task.state.abortController.signal.aborted)
          break
        ctx.emitter.emit('message:process', { messages, isTakeout: true, syncOptions })
        messages = []
        onProcessed?.(count)
      }
    }

    if (messages.length > 0 && !task.state.abortController.signal.aborted) {
      ctx.emitter.emit('message:process', { messages, isTakeout: true, syncOptions })
      onProcessed?.(count)
    }

    return !task.state.abortController.signal.aborted
  }

  async function runTakeout(params: {
    chatIds: string[]
    increase?: boolean
    syncOptions?: SyncOptions
  }) {
    let { chatIds } = params
    const { increase, syncOptions } = params
    const pagination = usePagination()

    if (chatIds.length === 0) {
      const accountId = ctx.getCurrentAccountId()
      const chats = (await chatModels.fetchChatsByAccountId(ctx.getDB(), accountId)).expect('Failed to fetch chats')
      chatIds = chats.map(c => c.chat_id)
    }

    for (const chatId of chatIds) {
      const stats = (await chatMessageStatsModels.getChatMessageStatsByChatId(ctx.getDB(), ctx.getCurrentAccountId(), chatId))?.unwrap()
      const task = createTask('takeout', { chatIds: [chatId] }, ctx.emitter, logger)
      activeTasks.set(task.state.taskId, task)

      try {
        if (!increase || !stats || (stats.first_message_id === 0 && stats.latest_message_id === 0)) {
          const opts = {
            pagination: { ...pagination, offset: 0 },
            minId: syncOptions?.minMessageId ?? 0,
            maxId: syncOptions?.maxMessageId ?? 0,
            startTime: syncOptions?.startTime,
            endTime: syncOptions?.endTime,
            skipMedia: !syncOptions?.syncMedia,
            task,
            syncOptions,
          }
          await processMessageBatch(task, takeoutMessages(chatId, opts), syncOptions)
        }
        else {
          const totalCount = (await getTotalMessageCount(chatId)) ?? 0
          const needToSyncCount = Math.max(0, totalCount - stats.message_count)
          task.updateProgress(0, 'Starting incremental sync')

          let totalProcessed = 0
          const updateProgress = (_count: number) => {
            const progress = needToSyncCount > 0 ? Number(((totalProcessed / needToSyncCount) * 100).toFixed(2)) : 0
            task.updateProgress(progress, `Processed ${totalProcessed}/${needToSyncCount} messages`)
          }

          // Phase 1: Backward
          const backwardOpts = {
            pagination: { ...pagination, offset: 0 },
            minId: syncOptions?.minMessageId ?? stats.latest_message_id ?? 0,
            maxId: syncOptions?.maxMessageId ?? 0,
            startTime: syncOptions?.startTime,
            endTime: syncOptions?.endTime,
            skipMedia: !syncOptions?.syncMedia,
            expectedCount: needToSyncCount,
            disableAutoProgress: true,
            task,
            syncOptions,
          }
          const ok = await processMessageBatch(task, takeoutMessages(chatId, backwardOpts), syncOptions, (c) => {
            totalProcessed += c
            updateProgress(totalProcessed)
          }, stats.latest_message_id ?? undefined)

          if (!ok)
            continue

          // Phase 2: Forward
          const forwardOpts = {
            pagination: { ...pagination, offset: stats.first_message_id ?? 0 },
            minId: syncOptions?.minMessageId ?? 0,
            maxId: syncOptions?.maxMessageId ?? 0,
            startTime: syncOptions?.startTime,
            endTime: syncOptions?.endTime,
            skipMedia: !syncOptions?.syncMedia,
            expectedCount: needToSyncCount,
            disableAutoProgress: true,
            task,
            syncOptions,
          }
          await processMessageBatch(task, takeoutMessages(chatId, forwardOpts), syncOptions, (c) => {
            totalProcessed += c
            updateProgress(totalProcessed)
          })

          if (!task.state.abortController.signal.aborted) {
            task.updateProgress(100, 'Incremental sync completed')
          }
        }
      }
      catch (error) {
        logger.withError(error).withFields({ chatId }).error('Takeout failed for chat')
        task.updateError(error)
      }
      finally {
        activeTasks.delete(task.state.taskId)
      }
    }
  }

  function abortTask(taskId: string) {
    logger.withFields({ taskId }).verbose('Aborting takeout task')
    const task = activeTasks.get(taskId)
    if (task) {
      task.abort()
      activeTasks.delete(taskId)
    }
    else {
      logger.withFields({ taskId }).warn('Task not found for abort')
    }
  }

  async function fetchChatSyncStats(chatId: string) {
    logger.withFields({ chatId }).verbose('Fetching chat sync stats')

    try {
      // Get chat message stats from DB
      const stats = (await chatMessageStatsModels.getChatMessageStatsByChatId(ctx.getDB(), ctx.getCurrentAccountId(), chatId))?.unwrap()

      // Get total message count from Telegram
      const totalMessageCount = (await getTotalMessageCount(chatId)) ?? 0

      const syncedMessages = stats?.message_count ?? 0
      const firstMessageId = stats?.first_message_id ?? 0
      const latestMessageId = stats?.latest_message_id ?? 0

      // Calculate synced ranges
      const syncedRanges: Array<{ start: number, end: number }> = []
      if (firstMessageId > 0 && latestMessageId > 0) {
        // For now, we assume a continuous range from first to latest
        // In the future, we could query the DB for gaps
        syncedRanges.push({ start: firstMessageId, end: latestMessageId })
      }

      const chatSyncStats = {
        chatId,
        totalMessages: totalMessageCount,
        syncedMessages,
        firstMessageId,
        latestMessageId,
        oldestMessageDate: stats?.first_message_at ? new Date(stats.first_message_at * 1000) : undefined,
        newestMessageDate: stats?.latest_message_at ? new Date(stats.latest_message_at * 1000) : undefined,
        syncedRanges,
      }

      ctx.emitter.emit('takeout:stats:data', chatSyncStats)
    }
    catch (error) {
      logger.withError(error).error('Failed to fetch chat sync stats')
      ctx.withError(error, 'Failed to fetch chat sync stats')
    }
  }

  return {
    takeoutMessages,
    getTotalMessageCount,
    runTakeout,
    abortTask,
    fetchChatSyncStats,
  }
}
