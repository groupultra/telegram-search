import type { Api } from 'telegram'

import type { CoreContext } from '../context'
import type { TakeoutService } from '../services'

import { usePagination } from '@tg-search/common/utils/pagination'
import { getChatMessageStatsByChatId } from '@tg-search/db'
import { useLogger } from '@unbird/logg'

import { MESSAGE_PROCESS_BATCH_SIZE } from '../constants'

export function registerTakeoutEventHandlers(ctx: CoreContext) {
  const { emitter } = ctx
  const logger = useLogger('core:takeout:event')

  return (takeoutService: TakeoutService) => {
    emitter.on('takeout:run', async ({ chatIds, increase }) => {
      logger.withFields({ chatIds, increase }).verbose('Running takeout')
      const pagination = usePagination()

      // Increase export
      const increaseOptions: { chatId: string, firstMessageId: number, latestMessageId: number }[] = await Promise.all(
        chatIds.map(async (chatId) => {
          const stats = (await getChatMessageStatsByChatId(chatId))?.unwrap()
          return {
            chatId,
            firstMessageId: stats.first_message_id ?? 0, // Forward increase
            latestMessageId: stats.latest_message_id ?? 0, // Backward increase
          }
        }),
      )

      logger.withFields({ increaseOptions }).verbose('Last message')

      let messages: Api.Message[] = []
      for (const chatId of chatIds) {
        const opts = {
          pagination: {
            ...pagination,
            // Forward increase
            offset: !increase ? (increaseOptions.find(item => item.chatId === chatId)?.firstMessageId ?? 0) : pagination.offset,
          },
          // Backward increase
          minId: increase ? (increaseOptions.find(item => item.chatId === chatId)?.latestMessageId) : 0,
        }

        for await (const message of takeoutService.takeoutMessages(chatId, opts)) {
          messages.push(message)
          // logger.withFields(message).debug('Message taken out')

          if (messages.length >= MESSAGE_PROCESS_BATCH_SIZE) {
            emitter.emit('message:process', { messages })
            messages = []
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
