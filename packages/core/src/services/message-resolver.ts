import type { Logger } from '@guiiai/logg'
import type { Api } from 'telegram'

import type { CoreContext } from '../context'
import type { MessageResolverRegistryFn } from '../message-resolvers'
import type { SyncOptions } from '../types/events'

import { chatMessageModels } from '../models/chat-message'
import { CoreEventType } from '../types/events'
import { convertToCoreMessage } from '../utils/message'

export type MessageResolverService = ReturnType<typeof createMessageResolverService>

export function createMessageResolverService(
  ctx: CoreContext,
  logger: Logger,
  resolvers: MessageResolverRegistryFn,
) {
  logger = logger.withContext('core:message-resolver:service')

  // TODO: worker_threads?
  async function processMessages(
    messages: Api.Message[],
    options: {
      takeout?: boolean
      syncOptions?: SyncOptions
      forceRefetch?: boolean
      batchId?: string
    } = {},
  ) {
    const start = performance.now()
    logger.withFields({
      count: messages.length,
      takeout: options.takeout,
      syncOptions: options.syncOptions,
      forceRefetch: options.forceRefetch,
    }).verbose('Process messages')

    // Sort by message ID in reverse order to process in reverse.
    messages = messages.sort((a, b) => Number(b.id) - Number(a.id))

    const coreMessages = messages
      .map(message => convertToCoreMessage(message).orUndefined())
      .filter(message => message != null)

    logger.withFields({ count: coreMessages.length }).debug('Converted messages')

    // TODO: Query user database to get user info

    // Return the messages to client first.
    if (!options.takeout) {
      ctx.emitter.emit(CoreEventType.MessageData, { messages: coreMessages })
    }

    // Storage the messages first and get the actual DB IDs
    const accountId = ctx.getCurrentAccountId()
    const recordedMessages = await chatMessageModels.recordMessages(ctx.getDB(), accountId, coreMessages)

    // Update coreMessages UUIDs with the actual DB IDs
    // Create a map for O(1) lookup: chat_id:platform_message_id -> db_uuid
    const messageIdMap = new Map<string, string>()
    for (const msg of recordedMessages) {
      messageIdMap.set(`${msg.in_chat_id}:${msg.platform_message_id}`, msg.id!)
    }

    // Apply the actual DB UUIDs to the core messages
    for (const msg of coreMessages) {
      const dbUuid = messageIdMap.get(`${msg.chatId}:${msg.platformMessageId}`)
      if (dbUuid) {
        msg.uuid = dbUuid
      }
    }

    // Avatar resolver is disabled by default (configured in generateDefaultConfig).
    // Current strategy: client-driven, on-demand avatar loading via entity:avatar:fetch.
    const disabledResolvers = (await ctx.getAccountSettings()).messageProcessing?.resolvers?.disabledResolvers

    // Embedding or resolve messages
    const resolverSpans: Array<{ name: string, duration: number, count: number }> = []

    const executeResolver = async (name: string, resolver: any) => {
      const resolverStart = performance.now()
      logger.withFields({ name }).verbose('Process messages with resolver')

      const opts = {
        messages: coreMessages,
        rawMessages: messages,
        syncOptions: options.syncOptions,
        forceRefetch: options.forceRefetch,
      }

      try {
        if (resolver.run) {
          const result = (await resolver.run(opts)).unwrap()

          if (result.length > 0) {
            ctx.emitter.emit(CoreEventType.StorageRecordMessages, { messages: result })
          }
        }
        else if (resolver.stream) {
          for await (const message of resolver.stream(opts)) {
            if (!options.takeout) {
              ctx.emitter.emit(CoreEventType.MessageData, { messages: [message] })
            }

            ctx.emitter.emit(CoreEventType.StorageRecordMessages, { messages: [message] })
          }
        }
      }
      catch (error) {
        logger.withError(error).warn('Failed to process messages')
      }
      finally {
        const duration = performance.now() - resolverStart
        resolverSpans.push({
          name,
          duration,
          count: coreMessages.length,
        })

        if (ctx.metrics) {
          ctx.metrics.resolverDuration.observe({ resolver: name }, duration)
        }
      }
    }

    // 分离出需要顺序执行的 resolvers
    const allResolvers = Array.from(resolvers.registry.entries())
      .filter(([name]) => {
        if (disabledResolvers.includes(name))
          return false
        if (name === 'media' && (options.syncOptions?.skipMedia || options.syncOptions?.syncMedia === false))
          return false
        if (name === 'embedding' && (options.syncOptions?.skipEmbedding))
          return false
        if (name === 'jieba' && (options.syncOptions?.skipJieba))
          return false
        // Photo embedding depends on media resolver, skip if media is disabled
        if (name === 'photo-embedding' && (options.syncOptions?.skipMedia || options.syncOptions?.syncMedia === false))
          return false
        return true
      })

    // 先执行 media resolver（如果存在）
    const mediaResolver = allResolvers.find(([name]) => name === 'media')
    if (mediaResolver) {
      await executeResolver(mediaResolver[0], mediaResolver[1])
    }

    // 然后并行执行其他 resolvers
    const otherResolvers = allResolvers.filter(([name]) => name !== 'media')
    const promises = otherResolvers.map(([name, resolver]) => executeResolver(name, resolver))

    await Promise.allSettled(promises)

    if (options.batchId) {
      ctx.emitter.emit(CoreEventType.MessageProcessed, {
        batchId: options.batchId,
        count: coreMessages.length,
        resolverSpans,
      })
    }

    // Record batch duration if metrics sink is available (Node/server runtime only).
    if (ctx.metrics) {
      const durationMs = performance.now() - start
      const source = options.takeout ? 'takeout' : 'realtime'
      ctx.metrics.messageBatchDuration.observe({ source }, durationMs)
      ctx.metrics.messagesProcessed.inc({ source }, coreMessages.length)
    }
  }

  return {
    processMessages,
  }
}
