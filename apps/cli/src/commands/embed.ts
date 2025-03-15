import * as input from '@inquirer/prompts'
import { useLogger } from '@tg-search/common'
import { EmbeddingService } from '@tg-search/core'
import { findMessageMissingEmbed, updateMessageEmbeddings, useEmbeddingTable } from '@tg-search/db'

import { TelegramCommand } from '../command'

const logger = useLogger()
interface EmbedOptions {
  batchSize?: number
  chatId?: number
  concurrency?: number
}

/**
 * Embed command to generate embeddings for messages
 */
export class EmbedCommand extends TelegramCommand {
  meta = {
    name: 'embed',
    description: 'Generate embeddings for messages',
    usage: '[options]',
  }

  async execute(_args: string[], options: EmbedOptions): Promise<void> {
    // Get chat ID (required)
    const chatId = options.chatId || await input.input({
      message: '请输入会话 ID：',
      default: '',
    })

    if (!chatId) {
      throw new Error('会话 ID 是必需的')
    }

    // Get batch size
    const batchSize = options.batchSize || await input.input({
      message: '请输入每批处理的消息数量：',
      default: '1000',
    })

    // Get concurrency
    const concurrency = options.concurrency || await input.input({
      message: '请输入并发数：',
      default: '4',
    })

    // Initialize embedding service
    const embedding = new EmbeddingService()
    await useEmbeddingTable(Number(chatId), embedding.getEmbeddingConfig())
    try {
      // Get all messages for the chat
      const messages = await findMessageMissingEmbed(Number(chatId), embedding.getEmbeddingConfig())
      logger.debug(`共有 ${messages.length} 条消息需要处理`)

      const totalMessages = messages.length

      logger.log(`共有 ${totalMessages} 条消息需要处理`)

      // Process messages in batches
      let totalProcessed = 0
      let failedEmbeddings = 0

      // Split messages into batches
      for (let i = 0; i < messages.length; i += Number(batchSize)) {
        const batch = messages.slice(i, i + Number(batchSize))
        logger.debug(`处理第 ${i + 1} 到 ${i + batch.length} 条消息`)

        // Generate embeddings in parallel
        const contents = batch.map(m => m.content!)
        const embeddings = await embedding.generateEmbeddings(contents)

        // Prepare updates
        const updates = batch
          .filter(message => message.uuid)
          .map((message, index) => ({
            id: message.uuid!,
            embedding: embeddings[index],
          }))

        try {
          // Update embeddings in batches with concurrency control
          for (let j = 0; j < updates.length; j += Number(concurrency)) {
            const concurrentBatch = updates.slice(j, j + Number(concurrency))
            await updateMessageEmbeddings(Number(chatId), concurrentBatch, embedding.getEmbeddingConfig())
            totalProcessed += concurrentBatch.length
          }
        }
        catch (error) {
          logger.withError(error).warn(`更新消息向量嵌入失败`)
          failedEmbeddings += batch.length
        }

        logger.log(`已处理 ${totalProcessed}/${totalMessages} 条消息，${failedEmbeddings} 条失败`)
      }

      logger.log('向量嵌入生成完成')
    }
    catch (error) {
      logger.withError(error).error('向量嵌入生成失败')
      throw error
    }
  }
}

// Register command
export default new EmbedCommand()
