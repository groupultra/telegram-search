import { useLogger } from '@tg-search/common'
import { EmbeddingService } from '@tg-search/core'
import { findMessagesByChatId, updateMessageEmbeddings } from '@tg-search/db'
import { z } from 'zod'

import { CommandHandlerBase } from '../command-handler'

const logger = useLogger()

/**
 * Embed command schema
 */
export const embedCommandSchema = z.object({
  chatId: z.number(),
  batchSize: z.number().min(1).max(10000).default(1000),
  concurrency: z.number().min(1).max(10).default(4),
})

/**
 * Embed command handler for generating embeddings for messages
 */
export class EmbedCommandHandler extends CommandHandlerBase<'embed'> {
  async execute(params: z.infer<typeof embedCommandSchema>) {
    const {
      chatId,
      batchSize,
      concurrency,
    } = params

    // Initialize embedding service
    const embedding = new EmbeddingService()

    try {
      // Get all messages for the chat
      const messages = await findMessagesByChatId(chatId)
      const messagesToEmbed = messages.items.filter(m => !m.embedding && m.content)
      const totalMessages = messagesToEmbed.length
      const totalBatches = Math.ceil(totalMessages / batchSize)

      this.callback.onProgress({
        status: 'running',
        progress: 0,
        message: `Found ${totalMessages} messages to process in ${totalBatches} batches`,
        metadata: {
          totalMessages,
          processedMessages: 0,
          failedMessages: 0,
          currentBatch: 0,
          totalBatches,
        },
      })

      logger.log(`Found ${totalMessages} messages to process`)

      // Process messages in batches
      let totalProcessed = 0
      let failedEmbeddings = 0
      let failedBatches = 0

      // Split messages into batches
      for (let i = 0; i < messagesToEmbed.length; i += batchSize) {
        const currentBatch = Math.floor(i / batchSize) + 1

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
            }
            catch (error) {
              logger.withError(error).warn(`Failed to update embeddings for ${concurrentBatch.length} messages in concurrent batch`)
              failedEmbeddings += concurrentBatch.length
            }

            // Update progress
            this.callback.onProgress({
              status: 'running',
              progress: Math.round((totalProcessed / totalMessages) * 100),
              message: `Processed ${totalProcessed}/${totalMessages} messages (Batch ${currentBatch}/${totalBatches}), ${failedEmbeddings} failed`,
              metadata: {
                totalMessages,
                processedMessages: totalProcessed,
                failedMessages: failedEmbeddings,
                currentBatch,
                totalBatches,
              },
            })
          }

          logger.log(`Processed batch ${currentBatch}/${totalBatches}: ${totalProcessed}/${totalMessages} messages, ${failedEmbeddings} failed`)
        }
        catch (error) {
          failedBatches++
          failedEmbeddings += batch.length
          logger.withError(error).warn(`Failed to process batch ${currentBatch}/${totalBatches} (${batch.length} messages)`)

          // Update progress even for failed batches
          this.callback.onProgress({
            status: 'running',
            progress: Math.round((totalProcessed / totalMessages) * 100),
            message: `Processed ${totalProcessed}/${totalMessages} messages (Batch ${currentBatch}/${totalBatches}), ${failedEmbeddings} failed (${failedBatches} batches failed)`,
            metadata: {
              totalMessages,
              processedMessages: totalProcessed,
              failedMessages: failedEmbeddings,
              currentBatch,
              totalBatches,
              error: error instanceof Error ? error : new Error(String(error)),
            },
          })

          // Continue with next batch
          continue
        }
      }

      // Set final status based on success/failure ratio
      const successRate = (totalProcessed / totalMessages) * 100
      if (successRate === 0) {
        throw new Error('All batches failed to process')
      }

      const status = failedEmbeddings > 0 ? 'failed' : 'completed'
      this.updateStatus(status, 100, `Completed processing ${totalProcessed}/${totalMessages} messages, ${failedEmbeddings} failed in ${failedBatches} batches`, {
        totalMessages,
        processedMessages: totalProcessed,
        failedMessages: failedEmbeddings,
        totalBatches,
      })
      logger.log(`Embedding generation ${status}: ${totalProcessed}/${totalMessages} messages processed, ${failedEmbeddings} failed`)
    }
    catch (error) {
      logger.withError(error).error('Failed to generate embeddings')
      this.callback.onError({
        status: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
      })
      throw error
    }
  }
}
