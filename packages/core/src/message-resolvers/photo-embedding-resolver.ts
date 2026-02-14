import type { Logger } from '@guiiai/logg'

import type { MessageResolver, MessageResolverOpts } from '.'
import type { CoreContext } from '../context'

import { Ok } from '@unbird/result'

import { photoModels } from '../models/photos'
import { EmbeddingDimension } from '../types/account-settings'
import { embedContents } from '../utils/embed'
import { describeImage } from '../utils/vision'

export function createPhotoEmbeddingResolver(ctx: CoreContext, logger: Logger): MessageResolver {
  logger = logger.withContext('core:resolver:photo-embedding')

  return {
    run: async (opts: MessageResolverOpts) => {
      const accountSettings = await ctx.getAccountSettings()
      const { visionLLM, embedding, messageProcessing } = accountSettings

      logger.withFields({
        enablePhotoEmbedding: messageProcessing?.enablePhotoEmbedding,
        hasVisionLlmApiKey: !!(visionLLM.apiKey && visionLLM.apiKey.trim() !== ''),
        hasEmbeddingApiKey: !!(embedding.apiKey && embedding.apiKey.trim() !== ''),
        messagesCount: opts.messages.length,
      }).log('Photo embedding resolver started')

      // 检查是否启用了图片 embedding 功能
      if (!messageProcessing?.enablePhotoEmbedding) {
        logger.warn('Photo embedding is disabled in settings. Please enable it in Settings → Message Processing → Enable Photo Embedding')
        return Ok([])
      }

      // 检查 Vision LLM API key 是否配置
      if (!visionLLM.apiKey || visionLLM.apiKey.trim() === '') {
        logger.warn('Vision LLM API key is not configured. Please configure it in Settings → API → Vision LLM')
        return Ok([])
      }

      // 检查 Embedding API key 是否配置
      if (!embedding.apiKey || embedding.apiKey.trim() === '') {
        logger.warn('Embedding API key is not configured. Please configure it in Settings → API')
        return Ok([])
      }

      const db = ctx.getDB()
      const messageUUIDs = opts.messages.map(m => m.uuid)

      logger.withFields({ messageUUIDs: messageUUIDs.slice(0, 3), totalCount: messageUUIDs.length }).log('Looking for photos with message UUIDs')

      if (messageUUIDs.length === 0) {
        return Ok([])
      }

      // 从数据库查询照片（media resolver 已经完成，照片应该已保存）
      const photosToProcess = await photoModels.findPhotosByMessageUUIDs(db, messageUUIDs)
        .then(result => result.orDefault([]))

      logger.withFields({
        photosCount: photosToProcess.length,
        samplePhotoIds: photosToProcess.slice(0, 3).map(p => ({ id: p.id, messageId: p.message_id })),
      }).log('Photos found in database')

      if (photosToProcess.length === 0) {
        return Ok([])
      }

      // 过滤出需要处理的照片（没有 embedding 的）
      const photosNeedProcessing = photosToProcess.filter((photo) => {
        const hasEmbedding = photo.description_vector_1536?.length
          || photo.description_vector_1024?.length
          || photo.description_vector_768?.length

        // 如果强制重新获取，或者没有 embedding，则需要处理
        return opts.forceRefetch || !hasEmbedding
      })

      logger.withFields({ count: photosNeedProcessing.length }).log('Photos need embedding')

      if (photosNeedProcessing.length === 0) {
        return Ok([])
      }

      // 批量生成描述
      const descriptionsToEmbed: Array<{ photoId: string, description: string }> = []

      for (const photo of photosNeedProcessing) {
        try {
          const hasDescription = photo.description && photo.description.trim() !== ''

          let description: string

          // 如果已有描述且不强制重新获取，使用现有描述
          if (hasDescription && !opts.forceRefetch) {
            description = photo.description
            logger.withFields({ photoId: photo.id }).log('Using existing description')
          }
          else {
            // 从数据库读取图片数据
            if (!photo.image_bytes) {
              logger.withFields({ photoId: photo.id }).warn('Photo has no image bytes in database, skipping')
              continue
            }

            // 生成新描述
            logger.withFields({
              photoId: photo.id,
              imageBytesLength: photo.image_bytes.length,
              imageBytesType: photo.image_bytes.constructor?.name,
            }).log('Generating description for photo')

            const descriptionResult = await describeImage(photo.image_bytes, visionLLM)
            const desc = descriptionResult.expect('Failed to generate description')

            description = desc.description
            logger.withFields({ photoId: photo.id, descriptionLength: description.length }).log('Generated description')
          }

          descriptionsToEmbed.push({ photoId: photo.id, description })
        }
        catch (error) {
          logger.withFields({ photoId: photo.id }).withError(error as Error).warn('Failed to process photo')
        }
      }

      if (descriptionsToEmbed.length === 0) {
        logger.warn('No descriptions to embed')
        return Ok([])
      }

      // 批量生成 embedding
      logger.withFields({ count: descriptionsToEmbed.length }).log('Generating embeddings for photos')

      const descriptions = descriptionsToEmbed.map(d => d.description)
      const embedResult = await embedContents(descriptions, embedding)
      const { embeddings, dimension } = embedResult.expect('Failed to generate embeddings')

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
          return Ok([])
      }

      // 批量更新数据库
      for (let i = 0; i < descriptionsToEmbed.length; i++) {
        const { photoId, description } = descriptionsToEmbed[i]
        const vector = embeddings[i]

        if (!vector) {
          logger.withFields({ photoId }).warn('No embedding vector generated')
          continue
        }

        try {
          await photoModels.updatePhotoEmbedding(db, photoId, {
            description,
            vector,
            dimension: validDimension,
          })

          logger.withFields({ photoId, dimension: validDimension }).log('Updated photo embedding')
        }
        catch (error) {
          logger.withFields({ photoId }).withError(error as Error).warn('Failed to update photo embedding')
        }
      }

      logger.withFields({
        count: descriptionsToEmbed.length,
        dimension: validDimension,
      }).log('Photo embedding completed')

      return Ok(opts.messages)
    },
  }
}
