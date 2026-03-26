import type { Logger } from '@guiiai/logg'
import type { Api } from 'telegram'

import type { CoreContext } from '../context'
import type { MessageResolver, MessageResolverRegistryFn } from '../message-resolvers'
import type { SyncOptions } from '../types/events'

import { withSpan } from '@tg-search/observability'

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
    return withSpan('resolver:processMessages', () => processMessagesInner(messages, options), {
      messageCount: messages.length,
      ...(options.takeout != null ? { takeout: options.takeout } : {}),
      ...(options.batchId != null ? { batchId: options.batchId } : {}),
    })
  }

  async function processMessagesInner(
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

    // Avatar resolver is disabled by default (configured in generateDefaultConfig).
    // Current strategy: client-driven, on-demand avatar loading via entity:avatar:fetch.
    const disabledResolvers = (await ctx.getAccountSettings()).messageProcessing?.resolvers?.disabledResolvers

    // Resolve enabled resolvers and preserve registration order.
    const allResolvers = Array.from(resolvers.registry.entries())
      .filter(([name]) => {
        const shouldSkip = disabledResolvers.includes(name)
          || (name === 'media' && (options.syncOptions?.skipMedia || options.syncOptions?.syncMedia === false))
          || (name === 'embedding' && (options.syncOptions?.skipEmbedding))
          || (name === 'jieba' && (options.syncOptions?.skipJieba))
          // Photo embedding depends on media resolver, skip if media is disabled
          || (name === 'photo-embedding' && (options.syncOptions?.skipMedia || options.syncOptions?.syncMedia === false))

        if (shouldSkip) {
          ctx.metrics?.resolverSkipped.inc({ resolver: name })
          return false
        }
        return true
      })

    const baseResolverOpts = {
      messages: coreMessages,
      rawMessages: messages,
      syncOptions: options.syncOptions,
      forceRefetch: options.forceRefetch,
    }

    // For realtime delivery, resolve sender names before the first client push.
    // Otherwise convertToCoreMessage may fall back to numeric IDs when Telegram
    // hasn't hydrated message.sender yet, and the UI keeps that stale value.
    const userResolver = allResolvers.find(([name]) => name === 'user')
    if (userResolver?.[1].run) {
      try {
        await withSpan('resolver:user:pre-emit', async () => {
          const result = (await userResolver[1].run!(baseResolverOpts)).unwrap()

          if (result.length > 0) {
            ctx.emitter.emit(CoreEventType.StorageRecordMessages, { messages: result })
          }
        }, { resolver: 'user', messageCount: coreMessages.length })
      }
      catch (error) {
        logger.withError(error).warn('Failed to resolve users before realtime message delivery')
      }
    }

    // Store the messages first and use the persisted metadata for client delivery.
    const accountId = ctx.getCurrentAccountId()
    const recordedMessages = await chatMessageModels.recordMessages(ctx.getDB(), accountId, coreMessages)

    // Update coreMessages with the actual DB metadata so refreshed pages retain
    // persisted state like updatedAt/deletedAt instead of falling back to the
    // transient Telegram payload.
    const messageRecordMap = new Map<string, typeof recordedMessages[number]>()
    for (const msg of recordedMessages) {
      messageRecordMap.set(`${msg.in_chat_id}:${msg.platform_message_id}`, msg)
    }

    // Apply the actual DB fields to the core messages.
    for (const msg of coreMessages) {
      const record = messageRecordMap.get(`${msg.chatId}:${msg.platformMessageId}`)
      if (record) {
        msg.uuid = record.id!
        msg.createdAt = record.created_at ?? msg.createdAt
        msg.updatedAt = record.updated_at ?? msg.updatedAt
        msg.deletedAt = record.deleted_at ?? msg.deletedAt
      }
    }

    if (!options.takeout) {
      ctx.emitter.emit(CoreEventType.MessageData, { messages: coreMessages })
    }

    // Embedding or resolve messages
    const resolverSpans: Array<{ name: string, duration: number, count: number }> = []

    const executeResolver = async (name: string, resolver: MessageResolver) => {
      return withSpan(`resolver:${name}`, async () => {
        const resolverStart = performance.now()
        logger.withFields({ name }).verbose('Process messages with resolver')

        try {
          if (resolver.run) {
            const result = (await resolver.run(baseResolverOpts)).unwrap()

            if (result.length > 0) {
              ctx.emitter.emit(CoreEventType.StorageRecordMessages, { messages: result })
            }
          }
          else if (resolver.stream) {
            for await (const message of resolver.stream(baseResolverOpts)) {
              if (!options.takeout) {
                ctx.emitter.emit(CoreEventType.MessageData, { messages: [message] })
              }

              ctx.emitter.emit(CoreEventType.StorageRecordMessages, { messages: [message] })
            }
          }

          ctx.metrics?.resolverOutcome.inc({ resolver: name, outcome: 'success' })
        }
        catch (error) {
          ctx.metrics?.resolverOutcome.inc({ resolver: name, outcome: 'error' })
          logger.withError(error).warn('Failed to process messages')
        }
        finally {
          const duration = performance.now() - resolverStart
          resolverSpans.push({
            name,
            duration,
            count: coreMessages.length,
          })

          ctx.metrics?.resolverDuration.observe({ resolver: name }, duration)
        }
      }, { resolver: name, messageCount: coreMessages.length })
    }

    // Run media first to satisfy downstream resolvers that depend on persisted media records.
    const mediaResolver = allResolvers.find(([name]) => name === 'media')
    if (mediaResolver) {
      await executeResolver(mediaResolver[0], mediaResolver[1])
    }

    // Run remaining resolvers concurrently after media is complete.
    const otherResolvers = allResolvers.filter(([name]) => name !== 'media' && name !== 'user')
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
    const durationMs = performance.now() - start
    const source = options.takeout ? 'takeout' : 'realtime'
    ctx.metrics?.messageBatchDuration.observe({ source }, durationMs)
    ctx.metrics?.messagesProcessed.inc({ source }, coreMessages.length)
  }

  return {
    processMessages,
  }
}
