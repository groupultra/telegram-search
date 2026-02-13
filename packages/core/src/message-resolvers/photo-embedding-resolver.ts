import type { Logger } from '@guiiai/logg'

import type { MessageResolver, MessageResolverOpts } from '.'
import type { CoreContext } from '../context'
import type { PhotoModels } from '../models/photos'
import type { CoreMessage } from '../types/message'

import { Ok } from '@unbird/result'

import { EmbeddingDimension } from '../types/account-settings'
import { embedContents } from '../utils/embed'
import { describeImage } from '../utils/vision'

export function createPhotoEmbeddingResolver(
  ctx: CoreContext,
  logger: Logger,
  photoModels: PhotoModels,
): MessageResolver {
  logger = logger.withContext('core:resolver:photo-embedding')

  return {
    run: async (opts: MessageResolverOpts) => {
      const accountSettings = await ctx.getAccountSettings()
      const { llm, embedding, messageProcessing } = accountSettings

      logger.withFields({ llmSettings: llm, embeddingSettings: embedding }).verbose('Executing photo embedding resolver')

      // 检查是否启用了图片 embedding 功能
      if (!messageProcessing?.enablePhotoEmbedding) {
        logger.debug('Photo embedding is disabled')
        return Ok([])
      }

      // 检查 LLM API key 是否配置
      if (!llm.apiKey || llm.apiKey.trim() === '') {
        logger.debug('Skipping photo embedding: LLM API key is empty')
        return Ok([])
      }

      // 检查 Embedding API key 是否配置
      if (!embedding.apiKey || embedding.apiKey.trim() === '') {
        logger.debug('Skipping photo embedding: Embedding API key is empty')
        return Ok([])
      }

      const db = ctx.getDB()

      // 筛选包含照片的消息
      const messagesWithPhotos: CoreMessage[] = []
      for (const message of opts.messages) {
        if (message.media && message.media.some(media => media.type === 'photo')) {
          messagesWithPhotos.push(message)
        }
      }

      if (messagesWithPhotos.length === 0) {
        logger.debug('No messages with photos to process')
        return Ok([])
      }

      logger.withFields({ count: messagesWithPhotos.length }).verbose('Processing messages with photos')

      // 处理每张照片
      for (const message of messagesWithPhotos) {
        for (const media of message.media || []) {
          if (media.type !== 'photo' || !media.queryId) {
            continue
          }

          try {
            // 从数据库获取照片数据
            const photoResult = await photoModels.findPhotoByQueryId(db, media.queryId)
            const photo = photoResult.orUndefined()

            if (!photo) {
              logger.withFields({ queryId: media.queryId }).debug('Photo not found in database')
              continue
            }

            // 如果已经有描述并且有embedding,跳过(除非是强制重新获取)
            const hasDescription = photo.description && photo.description.trim() !== ''
            const hasEmbedding = photo.description_vector_1536?.length
              || photo.description_vector_1024?.length
              || photo.description_vector_768?.length

            if (hasEmbedding && !opts.forceRefetch) {
              logger.withFields({ queryId: media.queryId }).debug('Photo already has embedding, skipping')
              continue
            }

            // 检查是否有图片数据
            if (!photo.image_bytes) {
              logger.withFields({ queryId: media.queryId }).debug('Photo has no image bytes')
              continue
            }

            // 如果已经有描述但没有embedding,直接使用现有描述进行embedding
            let description: string
            if (hasDescription && !opts.forceRefetch) {
              description = photo.description
              logger.withFields({ queryId: media.queryId }).verbose('Using existing description for embedding')
            }
            else {
              // 生成新的描述
              logger.withFields({ queryId: media.queryId, platformMessageId: message.platformMessageId }).verbose('Generating description for photo')

              const descriptionResult = await describeImage(photo.image_bytes, llm)
              const desc = descriptionResult.expect('Failed to generate image description')
              description = desc.description
              logger.withFields({ queryId: media.queryId, descriptionLength: description.length }).verbose('Generated description')
            }

            // 2. 对描述进行 embedding
            const embedResult = await embedContents([description], embedding)
            const { embeddings, dimension } = embedResult.expect('Failed to embed description')
            const vector = embeddings[0]

            if (!vector) {
              logger.warn('No embedding vector generated')
              continue
            }

            // 验证维度
            let validDimension: 768 | 1024 | 1536
            switch (dimension) {
              case EmbeddingDimension.DIMENSION_1536:
                validDimension = 1536
                break
              case EmbeddingDimension.DIMENSION_1024:
                validDimension = 1024
                break
              case EmbeddingDimension.DIMENSION_768:
                validDimension = 768
                break
              default:
                logger.withFields({ dimension }).warn('Unsupported embedding dimension')
                continue
            }

            // 3. 更新数据库中的照片记录
            const updateResult = await photoModels.updatePhotoEmbedding(db, media.queryId, {
              description,
              vector,
              dimension: validDimension,
            })
            updateResult.expect('Failed to update photo embedding')

            logger.withFields({
              queryId: media.queryId,
              dimension: validDimension,
              descriptionLength: description.length,
            }).verbose('Successfully updated photo with description and embedding')
          }
          catch (error) {
            logger.withError(error).warn('Failed to process photo embedding')
          }
        }
      }

      return Ok(opts.messages)
    },
  }
}
