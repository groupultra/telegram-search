import type { ITelegramClientAdapter } from '@tg-search/core'
import type { Command } from '../../types/apis/command'
import type { EmbedDetails } from '../../types/apis/embed'
import type { WebSocketPeer } from '../../utils/ws'

import { useLogger } from '@tg-search/common'
import { EmbeddingService } from '@tg-search/core'
import { findMessagesByChatId, updateMessageEmbeddings } from '@tg-search/db'
import { z } from 'zod'

import { BaseCommandHandler } from '../command-manager'

const logger = useLogger()

/**
 * Embed command schema
 */
export const embedCommandSchema = z.object({
  chatId: z.number(),
  batchSize: z.number().min(1).max(10000).default(1000),
  concurrency: z.number().min(1).max(10).default(4),
})

interface EmbedCommandOptions {
  chatId: number
  batchSize?: number
  concurrency?: number
}

interface EmbedCommand extends Command {
  metadata: EmbedDetails
}

export class EmbedCommandHandler extends BaseCommandHandler {
  constructor(peer: WebSocketPeer) {
    super(peer)
    this.command = {
      ...this.command,
      type: 'sync',
      metadata: {
        totalMessages: 0,
        processedMessages: 0,
        failedMessages: 0,
        currentBatch: 0,
        totalBatches: 0,
      },
    } as EmbedCommand
  }

  async execute(_client: ITelegramClientAdapter, params: EmbedCommandOptions) {
    const {
      chatId,
      batchSize = 1000,
      concurrency = 4,
    } = params

    // Initialize embedding service
    const embedding = new EmbeddingService()

    try {
      // Get all messages for the chat
      const messages = await findMessagesByChatId(chatId)
      const messagesToEmbed = messages.items.filter(m => !m.embedding && m.content)
      const totalMessages = messagesToEmbed.length
      const totalBatches = Math.ceil(totalMessages / batchSize)

      this.command.metadata = {
        ...this.command.metadata,
        totalMessages,
        totalBatches,
      }
      this.updateProgress(0, `Found ${totalMessages} messages to process in ${totalBatches} batches`)

      logger.log(`Found ${totalMessages} messages to process`)

      // Process messages in batches
      let totalProcessed = 0
      let failedEmbeddings = 0
      let failedBatches = 0

      // Split messages into batches
      for (let i = 0; i < messagesToEmbed.length; i += batchSize) {
        const currentBatch = Math.floor(i / batchSize) + 1
        this.command.metadata.currentBatch = currentBatch

        const batch = messagesToEmbed.slice(i, i + batchSize)
        logger.debug(`Processing batch ${currentBatch}/${totalBatches} (${batch.length} messages)`)

        try {
          // Generate embeddings in parallel
          const contents = batch.map(m => m.content!)
          const embeddings = await embedding.generateEmbeddings(contents)

          // Prepare updates
          const updates = batch.map((message, index) => ({
            id: message.id,
            embedding: embeddings[index],
          }))

          // Update embeddings in batches with concurrency control
          for (let j = 0; j < updates.length; j += concurrency) {
            const concurrentBatch = updates.slice(j, j + concurrency)
            try {
              await updateMessageEmbeddings(chatId, concurrentBatch)
              totalProcessed += concurrentBatch.length
              this.command.metadata.processedMessages = totalProcessed
            }
            catch (error) {
              logger.withError(error).warn(`Failed to update embeddings for ${concurrentBatch.length} messages in concurrent batch`)
              failedEmbeddings += concurrentBatch.length
              this.command.metadata.failedMessages = failedEmbeddings
            }

            // Update progress
            const progress = Math.round((totalProcessed / totalMessages) * 100)
            this.updateProgress(
              progress,
              `Processed ${totalProcessed}/${totalMessages} messages (Batch ${currentBatch}/${totalBatches}), ${failedEmbeddings} failed`,
            )
          }

          logger.log(`Processed batch ${currentBatch}/${totalBatches}: ${totalProcessed}/${totalMessages} messages, ${failedEmbeddings} failed`)
        }
        catch (error) {
          failedBatches++
          failedEmbeddings += batch.length
          this.command.metadata.failedMessages = failedEmbeddings
          logger.withError(error).warn(`Failed to process batch ${currentBatch}/${totalBatches} (${batch.length} messages)`)

          // Update progress even for failed batches
          const progress = Math.round((totalProcessed / totalMessages) * 100)
          this.updateProgress(
            progress,
            `Processed ${totalProcessed}/${totalMessages} messages (Batch ${currentBatch}/${totalBatches}), ${failedEmbeddings} failed (${failedBatches} batches failed)`,
          )

          // Continue with next batch
          continue
        }
      }

      // Set final status based on success/failure ratio
      const successRate = (totalProcessed / totalMessages) * 100
      if (successRate === 0) {
        throw new Error('All batches failed to process')
      }

      this.handleComplete({
        processedMessages: totalProcessed,
        failedMessages: failedEmbeddings,
        failedBatches,
        successRate,
      })
    }
    catch (error) {
      logger.withError(error).error('Failed to generate embeddings')
      this.handleError(error as Error)
      throw error
    }
  }
}
