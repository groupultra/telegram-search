import type { Logger } from '@guiiai/logg'
import type { Result } from '@unbird/result'
import type { EntityLike } from 'telegram/define'

import type { CoreContext } from '../context'
import type { ChatMessageStatsModels, ChatModels } from '../models'
import type { SyncOptions, TakeoutOpts } from '../types/events'
import type { EntityService } from './entity'

import bigInt from 'big-integer'

import { usePagination } from '@tg-search/common'
import { Err, Ok } from '@unbird/result'
import { Api } from 'telegram'

import { MESSAGE_PROCESS_BATCH_SIZE, TELEGRAM_HISTORY_INTERVAL_MS } from '../constants'
import { CoreEventType } from '../types/events'
import { createMinIntervalWaiter } from '../utils/min-interval'
import { createTask } from '../utils/task'

export type TakeoutService = ReturnType<typeof createTakeoutService>

// https://core.telegram.org/api/takeout
export function createTakeoutService(
  ctx: CoreContext,
  logger: Logger,
  chatModels: ChatModels,
  chatMessageStatsModels: ChatMessageStatsModels,
  entityService: EntityService,
) {
  logger = logger.withContext('core:takeout:service')

  // Store active tasks by taskId for abort handling
  const activeTasks = new Map<string, ReturnType<typeof createTask>>()

  // Abortable min-interval waiter shared within this service
  const waitHistoryInterval = createMinIntervalWaiter(TELEGRAM_HISTORY_INTERVAL_MS)

  /**
   * Normalize potentially stringly-typed IDs coming from DB drivers or external inputs.
   * GramJS expects JS numbers for offsetId/minId/maxId.
   */
  function normalizeId(value: unknown, fallback = 0): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
    return fallback
  }

  const TAKEOUT_INIT_TIMEOUT_MS = 30_000

  async function initTakeout(): Promise<Api.account.Takeout> {
    const fileMaxSize = bigInt(1024 * 1024 * 1024) // 1GB

    logger.log('Initializing takeout session...')

    const invokePromise = ctx.getClient().invoke(new Api.account.InitTakeoutSession({
      contacts: true,
      messageUsers: true,
      messageChats: true,
      messageMegagroups: true,
      messageChannels: true,
      files: true,
      fileMaxSize,
    }))

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined
    let timedOut = false

    // Guard against indefinite hangs (e.g. connection overloaded by concurrent
    // downloads, or Telegram silently ignoring the request).
    try {
      const result = await Promise.race([
        invokePromise,
        new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            timedOut = true
            reject(new Error('Takeout session init timed out after 30s'))
          }, TAKEOUT_INIT_TIMEOUT_MS)
        }),
      ])

      logger.withFields({ takeoutId: result.id.toString() }).log('Takeout session initialized')
      return result
    }
    catch (error) {
      // Init timed out, but the underlying request may still resolve later.
      // Clean up that late session so we don't leak server-side takeout sessions.
      if (timedOut) {
        void invokePromise
          .then(async (lateTakeout) => {
            logger.withFields({ takeoutId: lateTakeout.id.toString() }).warn('Takeout session initialized after timeout, finishing late session')
            try {
              await finishTakeout(lateTakeout, false)
            }
            catch (finishError) {
              logger.withError(finishError).warn('Failed to finish late takeout session')
            }
          })
          .catch((lateError) => {
            logger.withError(lateError).debug('Late takeout init rejected after timeout')
          })
      }

      throw error
    }
    finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle)
      }
    }
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
      // Resolve peer via entityService to get the correct InputPeer type and accessHash
      // from the DB, avoiding misidentification (e.g. channel treated as PeerUser).
      const peer = await entityService.getInputPeer(chatId as string | number)
      const history = await ctx.getClient()
        .invoke(new Api.messages.GetHistory({
          peer,
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
      logger.withFields({ chatId }).log('Fetching total message count')
      const history = (await getHistoryWithMessagesCount(chatId)).expect('Failed to get history')
      const count = history.count ?? 0
      logger.withFields({ chatId, count }).log('Total message count fetched')
      return count
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

    let offsetId = normalizeId(options.pagination.offset, 0)
    let hasMore = true
    let processedCount = 0

    const limit = options.pagination.limit
    const minId = normalizeId(options.minId, 0)
    const maxId = normalizeId(options.maxId, 0)

    // Try to initialize a takeout session. If it fails (timeout, flood-wait,
    // or other error), fall back to regular GetHistory calls. Takeout is
    // preferred because it avoids per-chat rate limits, but is not required.
    let takeoutSession: Api.account.Takeout | undefined

    try {
      takeoutSession = await initTakeout()
    }
    catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      logger.withError(error).warn(`Takeout session init failed, falling back to regular GetHistory: ${errMsg}`)
      if (!options.disableAutoProgress) {
        task.updateProgress(0, 'Takeout unavailable, using regular sync')
      }
    }

    try {
      // Only emit initial progress if auto-progress is enabled
      if (!options.disableAutoProgress) {
        task.updateProgress(0, 'Get messages')
      }

      // Use provided expected count, or fetch from Telegram
      const count = options.expectedCount ?? (await getHistoryWithMessagesCount(chatId)).expect('Failed to get history').count

      logger.withFields({ expectedCount: count, providedCount: options.expectedCount, useTakeout: !!takeoutSession }).log('Starting message fetch')

      while (hasMore && !task.state.abortController.signal.aborted) {
        // https://core.telegram.org/api/offsets#hash-generation
        const id = BigInt(chatId)
        const hashBigInt = id ^ (id >> 21n) ^ (id << 35n) ^ (id >> 4n) + id
        const hash = bigInt(hashBigInt.toString())

        // Resolve peer via entityService to get the correct InputPeer type and accessHash
        // from the DB, avoiding misidentification (e.g. channel treated as PeerUser).
        const peer = await entityService.getInputPeer(chatId)
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

        // Wrap in takeout if available; otherwise call GetHistory directly.
        const result = takeoutSession
          ? await ctx.getClient().invoke(
            new Api.InvokeWithTakeout({
              takeoutId: takeoutSession.id,
              query: historyQuery,
            }),
          ) as unknown as Api.messages.MessagesSlice
          : await ctx.getClient().invoke(historyQuery) as unknown as Api.messages.MessagesSlice

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

          // Time range filtering
          if (options.endTime && message.date > options.endTime / 1000) {
            continue
          }
          if (options.startTime && message.date < options.startTime / 1000) {
            hasMore = false
            break
          }

          processedCount++
          yield message
        }

        offsetId = normalizeId(messages[messages.length - 1]?.id, offsetId)

        // Only emit progress if auto-progress is enabled
        if (!options.disableAutoProgress) {
          task.updateProgress(
            Number(((processedCount / count) * 100).toFixed(2)),
            `Processed ${processedCount}/${count} messages`,
          )
        }

        logger.withFields({ processedCount, count }).verbose('Processed messages')
      }

      if (takeoutSession) {
        await finishTakeout(takeoutSession, true)
      }

      if (task.state.abortController.signal.aborted) {
        // Task was aborted, handler layer already updated task status
        logger.withFields({ taskId: task.state.taskId }).verbose('Takeout messages aborted')
        return
      }

      // Only emit final progress if auto-progress is enabled
      if (!options.disableAutoProgress) {
        task.updateProgress(100)
      }
      logger.withFields({ taskId: task.state.taskId }).log('Takeout messages finished')
    }
    catch (error) {
      logger.withError(error).error('Takeout messages failed')

      // Preserve the original error for better error reporting
      const errorToEmit = error instanceof Error ? error : new Error('Takeout messages failed')

      if (takeoutSession) {
        await finishTakeout(takeoutSession, false)
      }
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
    let downloadCount = 0
    let processedCount = 0
    let batchSeq = 0

    const startTime = performance.now()
    const pendingBatches = new Set<string>()

    // Metrics tracking
    const totalResolverSpans: Array<{ name: string, duration: number, count: number }> = []

    const onMessageProcessed = (data: { batchId: string, count: number, resolverSpans: Array<{ name: string, duration: number, count: number }> }) => {
      if (pendingBatches.has(data.batchId)) {
        pendingBatches.delete(data.batchId)
        processedCount += data.count

        // Aggregate resolver spans
        data.resolverSpans.forEach((span) => {
          const existing = totalResolverSpans.find(s => s.name === span.name)
          if (existing) {
            existing.duration += span.duration
            existing.count += span.count
          }
          else {
            totalResolverSpans.push({ ...span })
          }
        })

        const now = performance.now()
        const elapsedSec = (now - startTime) / 1000
        const downloadSpeed = elapsedSec > 0 ? downloadCount / elapsedSec : 0
        const processSpeed = elapsedSec > 0 ? processedCount / elapsedSec : 0

        ctx.emitter.emit(CoreEventType.TakeoutMetrics, {
          taskId: task.state.taskId,
          downloadSpeed,
          processSpeed,
          processedCount,
          totalCount: task.state.metadata?.totalMessages ?? 0,
          resolverSpans: totalResolverSpans.map(s => ({ ...s, duration: s.duration })),
        })

        onProcessed?.(processedCount)
      }
    }

    ctx.emitter.on(CoreEventType.MessageProcessed, onMessageProcessed)

    try {
      for await (const message of generator) {
        if (task.state.abortController.signal.aborted)
          break
        if (skipId && message.id === skipId)
          continue

        messages.push(message)
        downloadCount++

        if (ctx.metrics) {
          ctx.metrics.takeoutDownloadTotal.inc()
        }

        if (messages.length >= MESSAGE_PROCESS_BATCH_SIZE) {
          if (task.state.abortController.signal.aborted)
            break

          const batchId = `${task.state.taskId}-${batchSeq++}`
          pendingBatches.add(batchId)

          ctx.emitter.emit(CoreEventType.MessageProcess, { messages, isTakeout: true, syncOptions, batchId })
          messages = []

          // Update metrics (even if not processed yet, for download speed visibility)
          const now = performance.now()
          const elapsedSec = (now - startTime) / 1000
          const downloadSpeed = elapsedSec > 0 ? downloadCount / elapsedSec : 0
          const processSpeed = elapsedSec > 0 ? processedCount / elapsedSec : 0

          ctx.emitter.emit(CoreEventType.TakeoutMetrics, {
            taskId: task.state.taskId,
            downloadSpeed,
            processSpeed,
            processedCount,
            totalCount: task.state.metadata?.totalMessages ?? 0,
            resolverSpans: totalResolverSpans,
          })
        }
      }

      if (messages.length > 0 && !task.state.abortController.signal.aborted) {
        const batchId = `${task.state.taskId}-${batchSeq++}`
        pendingBatches.add(batchId)
        ctx.emitter.emit(CoreEventType.MessageProcess, { messages, isTakeout: true, syncOptions, batchId })
      }

      // Wait for all pending batches to complete
      while (pendingBatches.size > 0 && !task.state.abortController.signal.aborted) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    finally {
      ctx.emitter.off(CoreEventType.MessageProcessed, onMessageProcessed)
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
      const totalCount = (await getTotalMessageCount(chatId)) ?? 0

      logger.withFields({ chatId, totalCount, hasStats: !!stats }).log('Starting takeout for chat')

      const task = createTask('takeout', { chatIds: [chatId], totalMessages: totalCount }, ctx.emitter, logger)
      activeTasks.set(task.state.taskId, task)

      try {
        const updateProgress = (count: number, expected: number) => {
          const progress = expected > 0 ? Number(((count / expected) * 100).toFixed(2)) : 0
          task.updateProgress(progress, `Processed ${count}/${expected} messages`)
        }

        if (!increase || !stats || (stats.first_message_id === 0 && stats.latest_message_id === 0)) {
          const opts = {
            pagination: { ...pagination, offset: 0 },
            minId: normalizeId(syncOptions?.minMessageId, 0),
            maxId: normalizeId(syncOptions?.maxMessageId, 0),
            startTime: syncOptions?.startTime,
            endTime: syncOptions?.endTime,
            skipMedia: !syncOptions?.syncMedia,
            expectedCount: totalCount,
            disableAutoProgress: true,
            task,
            syncOptions,
          }
          await processMessageBatch(task, takeoutMessages(chatId, opts), syncOptions, (c) => {
            updateProgress(c, totalCount)
          })
        }
        else {
          const needToSyncCount = Math.max(0, totalCount - stats.message_count)
          task.updateProgress(0, 'Starting incremental sync')

          const latestMessageId = normalizeId(stats.latest_message_id, 0)
          let backwardProcessed = 0
          // Phase 1: Backward
          const backwardOpts = {
            pagination: { ...pagination, offset: 0 },
            minId: normalizeId(syncOptions?.minMessageId ?? latestMessageId, 0),
            maxId: normalizeId(syncOptions?.maxMessageId, 0),
            startTime: syncOptions?.startTime,
            endTime: syncOptions?.endTime,
            skipMedia: !syncOptions?.syncMedia,
            expectedCount: needToSyncCount,
            disableAutoProgress: true,
            task,
            syncOptions,
          }
          const ok = await processMessageBatch(task, takeoutMessages(chatId, backwardOpts), syncOptions, (c) => {
            backwardProcessed = c
            updateProgress(backwardProcessed, needToSyncCount)
          }, latestMessageId > 0 ? latestMessageId : undefined)

          if (!ok)
            continue

          // Phase 2: Forward
          const forwardOpts = {
            pagination: { ...pagination, offset: normalizeId(stats.first_message_id, 0) },
            minId: normalizeId(syncOptions?.minMessageId, 0),
            maxId: normalizeId(syncOptions?.maxMessageId, 0),
            startTime: syncOptions?.startTime,
            endTime: syncOptions?.endTime,
            skipMedia: !syncOptions?.syncMedia,
            expectedCount: needToSyncCount,
            disableAutoProgress: true,
            task,
            syncOptions,
          }
          await processMessageBatch(task, takeoutMessages(chatId, forwardOpts), syncOptions, (c) => {
            updateProgress(backwardProcessed + c, needToSyncCount)
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

      ctx.emitter.emit(CoreEventType.TakeoutStatsData, chatSyncStats)
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
