import type { ITelegramClientAdapter } from '@tg-search/core'
import type { Command } from '../../types/apis/command'

import { useLogger } from '@tg-search/common'
import { EmbeddingService } from '@tg-search/core'
import { findMessagesByChatId, updateMessageEmbeddings } from '@tg-search/db'
import { z } from 'zod'

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
  metadata: {
    total: number
  }
}

export class EmbedCommandHandler {
  // Command metadata
  private options?: {
    onProgress: (command: Command) => void
    onComplete: (command: Command) => void
    onError: (command: Command, error: Error) => void
  }

  /**
   * Execute the embed command
   */
  async execute(_client: ITelegramClientAdapter, params: EmbedCommandOptions) {
    const {
      chatId,
      batchSize = 1000,
      concurrency = 4,
    } = params

    // Initialize embedding service
    const embedding = new EmbeddingService()
    const command: EmbedCommand = {
      id: crypto.randomUUID(),
      type: 'sync',
      status: 'running',
      progress: 0,
      message: 'Starting embedding generation',
      metadata: {
        total: 0,
      },
    }

    try {
      // Get all messages for the chat
      const messages = await findMessagesByChatId(chatId)
      const messagesToEmbed = messages.items.filter(m => !m.embedding && m.content)
      const totalMessages = messagesToEmbed.length

      command.metadata.total = totalMessages
      command.message = `Found ${totalMessages} messages to process`
      this.options?.onProgress(command)

      logger.log(`Found ${totalMessages} messages to process`)

      // Process messages in batches
      let totalProcessed = 0
      let failedEmbeddings = 0
      let failedBatches = 0

      // Split messages into batches
      for (let i = 0; i < messagesToEmbed.length; i += batchSize) {
        const batch = messagesToEmbed.slice(i, i + batchSize)
        logger.debug(`Processing messages ${i + 1} to ${i + batch.length}`)

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
            }
            catch (error) {
              logger.withError(error).warn(`Failed to update embeddings for ${concurrentBatch.length} messages in concurrent batch`)
              failedEmbeddings += concurrentBatch.length
            }

            // Update progress
            command.progress = Math.round((totalProcessed / totalMessages) * 100)
            command.message = `Processed ${totalProcessed}/${totalMessages} messages, ${failedEmbeddings} failed`
            this.options?.onProgress(command)
          }

          logger.log(`Processed batch ${i / batchSize + 1}: ${totalProcessed}/${totalMessages} messages, ${failedEmbeddings} failed`)
        }
        catch (error) {
          failedBatches++
          failedEmbeddings += batch.length
          logger.withError(error).warn(`Failed to process batch ${i / batchSize + 1} (${batch.length} messages)`)

          // Update progress even for failed batches
          command.progress = Math.round((totalProcessed / totalMessages) * 100)
          command.message = `Processed ${totalProcessed}/${totalMessages} messages, ${failedEmbeddings} failed (${failedBatches} batches failed)`
          this.options?.onProgress(command)

          // Continue with next batch
          continue
        }
      }

      // Set final status based on success/failure ratio
      const successRate = (totalProcessed / totalMessages) * 100
      if (successRate === 0) {
        throw new Error('All batches failed to process')
      }

      command.status = failedEmbeddings > 0 ? 'failed' : 'completed'
      command.message = `Completed processing ${totalProcessed}/${totalMessages} messages, ${failedEmbeddings} failed in ${failedBatches} batches`
      this.options?.onComplete(command)
      logger.log(`Embedding generation ${command.status}: ${command.message}`)
    }
    catch (error) {
      logger.withError(error).error('Failed to generate embeddings')
      command.status = 'failed'
      command.message = 'Failed to generate embeddings'
      command.error = error as Error
      this.options?.onError(command, error as Error)
      throw error
    }
  }
}
