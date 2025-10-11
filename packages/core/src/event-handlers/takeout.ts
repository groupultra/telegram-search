import type { Api } from 'telegram'

import type { CoreContext } from '../context'
import type { TakeoutService } from '../services'

import { usePagination } from '@tg-search/common'
import { useLogger } from '@unbird/logg'

import { MESSAGE_PROCESS_BATCH_SIZE } from '../constants'
import { getChatMessageStatsByChatId } from '../models'
import { useTasks } from '../utils/task'

export function registerTakeoutEventHandlers(ctx: CoreContext) {
  const { emitter } = ctx
  const logger = useLogger('core:takeout:event')
  const { createTask, updateTaskProgress } = useTasks('takeout')

  return (takeoutService: TakeoutService) => {
    emitter.on('takeout:run', async ({ chatIds, increase }) => {
      logger.withFields({ chatIds, increase }).verbose('Running takeout')
      const pagination = usePagination()

      // Get chat message stats for incremental sync
      const increaseOptions: { chatId: string, firstMessageId: number, latestMessageId: number, messageCount: number }[] = await Promise.all(
        chatIds.map(async (chatId) => {
          const stats = (await getChatMessageStatsByChatId(chatId))?.unwrap()
          return {
            chatId,
            firstMessageId: stats?.first_message_id ?? 0, // First synced message ID
            latestMessageId: stats?.latest_message_id ?? 0, // Latest synced message ID
            messageCount: stats?.message_count ?? 0, // Number of messages already in DB
          }
        }),
      )

      logger.withFields({ increaseOptions }).verbose('Chat message stats')

      let messages: Api.Message[] = []

      for (const chatId of chatIds) {
        const stats = increaseOptions.find(item => item.chatId === chatId)

        if (!increase) {
          // Full sync mode: sync all messages (overwrite)
          logger.withFields({ chatId, mode: 'full' }).verbose('Starting full sync')
          const opts = {
            pagination: {
              ...pagination,
              offset: 0,
            },
            minId: 0,
            maxId: 0,
          }

          for await (const message of takeoutService.takeoutMessages(chatId, opts)) {
            messages.push(message)

            if (messages.length >= MESSAGE_PROCESS_BATCH_SIZE) {
              emitter.emit('message:process', { messages })
              messages = []
            }
          }
        }
        else {
          // Incremental sync mode: bidirectional fill (forward + backward)
          // Only sync if there are already some messages in the database
          if (!stats || (stats.firstMessageId === 0 && stats.latestMessageId === 0)) {
            logger.withFields({ chatId }).warn('No existing messages found, switching to full sync')
            const opts = {
              pagination: {
                ...pagination,
                offset: 0,
              },
              minId: 0,
              maxId: 0,
            }

            for await (const message of takeoutService.takeoutMessages(chatId, opts)) {
              messages.push(message)

              if (messages.length >= MESSAGE_PROCESS_BATCH_SIZE) {
                emitter.emit('message:process', { messages })
                messages = []
              }
            }
          }
          else {
            // Incremental sync mode: bidirectional fill (backward + forward)
            // Calculate expected count: total messages - already synced messages

            // First, get total message count from Telegram
            const totalMessageCount = (await takeoutService.getTotalMessageCount(chatId)) ?? 0
            const alreadySyncedCount = stats.messageCount
            const needToSyncCount = Math.max(0, totalMessageCount - alreadySyncedCount)

            logger.withFields({
              chatId,
              totalMessages: totalMessageCount,
              alreadySynced: alreadySyncedCount,
              needToSync: needToSyncCount,
            }).verbose('Incremental sync calculation')

            // Create task for manual progress management
            const { taskId } = createTask({ chatIds: [chatId] })
            emitter.emit('takeout:task:progress', updateTaskProgress(taskId, 0, 'Starting incremental sync'))

            let totalProcessed = 0

            // Phase 1: Backward fill - sync messages after latest_message_id (newer messages)
            // For getting newer messages, we need to start from offsetId=0 (newest) and use minId filter
            logger.withFields({ chatId, mode: 'incremental-backward', minId: stats.latestMessageId }).verbose('Starting backward fill')
            const backwardOpts = {
              pagination: {
                ...pagination,
                offset: 0, // Start from the newest message
              },
              minId: stats.latestMessageId, // Filter: only get messages > latestMessageId
              maxId: 0,
              expectedCount: needToSyncCount, // This is the calculated number of messages that need to be synced for accurate progress tracking
              disableAutoProgress: true, // Disable auto progress to prevent reset between phases
            }

            let backwardMessageCount = 0
            for await (const message of takeoutService.takeoutMessages(chatId, backwardOpts)) {
              // Skip the latestMessageId itself (we already have it)
              if (message.id === stats.latestMessageId) {
                continue
              }

              messages.push(message)
              backwardMessageCount++
              totalProcessed++

              if (messages.length >= MESSAGE_PROCESS_BATCH_SIZE) {
                emitter.emit('message:process', { messages })
                messages = []

                // Emit progress update after batch processing
                const progress = needToSyncCount > 0 ? Number((totalProcessed / needToSyncCount).toFixed(2)) : 0
                emitter.emit('takeout:task:progress', updateTaskProgress(
                  taskId,
                  progress,
                  `Processed ${totalProcessed}/${needToSyncCount} messages`,
                ))
              }
            }

            logger.withFields({ chatId, count: backwardMessageCount }).verbose('Backward fill completed')

            // Phase 2: Forward fill - sync messages before first_message_id (older messages)
            // Start from the first synced message and go backwards (towards message ID 1)
            logger.withFields({ chatId, mode: 'incremental-forward', startFrom: stats.firstMessageId }).verbose('Starting forward fill')
            const forwardOpts = {
              pagination: {
                ...pagination,
                offset: stats.firstMessageId, // Start from first synced message
              },
              minId: 0, // No lower limit
              maxId: 0, // Will fetch older messages from offsetId
              expectedCount: needToSyncCount, // Use calculated count for accurate progress
              disableAutoProgress: true, // Disable auto progress to prevent reset between phases
            }

            let forwardMessageCount = 0
            for await (const message of takeoutService.takeoutMessages(chatId, forwardOpts)) {
              messages.push(message)
              forwardMessageCount++
              totalProcessed++

              if (messages.length >= MESSAGE_PROCESS_BATCH_SIZE) {
                emitter.emit('message:process', { messages })
                messages = []

                // Emit progress update after batch processing
                const progress = needToSyncCount > 0 ? Number((totalProcessed / needToSyncCount).toFixed(2)) : 0
                emitter.emit('takeout:task:progress', updateTaskProgress(
                  taskId,
                  progress,
                  `Processed ${totalProcessed}/${needToSyncCount} messages`,
                ))
              }
            }

            logger.withFields({ chatId, count: forwardMessageCount }).verbose('Forward fill completed')

            // Mark as complete
            emitter.emit('takeout:task:progress', updateTaskProgress(taskId, 100, 'Incremental sync completed'))
          }
        }
      }

      if (messages.length > 0) {
        emitter.emit('message:process', { messages })
      }
    })

    emitter.on('takeout:task:abort', ({ taskId }) => {
      logger.withFields({ taskId }).verbose('Aborting takeout task')
      takeoutService.abortTask(taskId)
    })
  }
}
