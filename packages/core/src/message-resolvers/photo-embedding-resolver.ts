import type { Logger } from '@guiiai/logg'

import type { MessageResolver, MessageResolverOpts } from '.'
import type { CoreContext } from '../context'

import { Ok } from '@unbird/result'

import { photoModels } from '../models/photos'
import { EmbeddingDimension } from '../types/account-settings'
import { embedContents } from '../utils/embed'
import { describeImage } from '../utils/vision'

type SupportedVectorDimension = 768 | 1024 | 1536

const EMBEDDING_DIMENSION_TO_VECTOR_DIMENSION: Record<EmbeddingDimension, SupportedVectorDimension> = {
  [EmbeddingDimension.DIMENSION_1536]: 1536,
  [EmbeddingDimension.DIMENSION_1024]: 1024,
  [EmbeddingDimension.DIMENSION_768]: 768,
}

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

      // Skip expensive vision/embedding calls unless photo embedding is explicitly enabled.
      if (!messageProcessing?.enablePhotoEmbedding) {
        logger.warn('Photo embedding is disabled in settings. Please enable it in Settings → Message Processing → Enable Photo Embedding')
        return Ok([])
      }

      // Guard against misconfiguration before hitting remote APIs.
      if (!visionLLM.apiKey || visionLLM.apiKey.trim() === '') {
        logger.warn('Vision LLM API key is not configured. Please configure it in Settings → API → Vision LLM')
        return Ok([])
      }

      // Guard against misconfiguration before hitting remote APIs.
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

      // Media resolver runs first, so target photos should already be persisted.
      const photosToProcess = await photoModels.findPhotosByMessageUUIDs(db, messageUUIDs)
        .then(result => result.orDefault([]))

      logger.withFields({
        photosCount: photosToProcess.length,
        samplePhotoIds: photosToProcess.slice(0, 3).map(p => ({ id: p.id, messageId: p.message_id })),
      }).log('Photos found in database')

      if (photosToProcess.length === 0) {
        return Ok([])
      }

      // Re-process only when forced or when no vector exists yet.
      const photosNeedProcessing = photosToProcess.filter((photo) => {
        const hasEmbedding = photo.description_vector_1536?.length
          || photo.description_vector_1024?.length
          || photo.description_vector_768?.length

        return opts.forceRefetch || !hasEmbedding
      })

      logger.withFields({ count: photosNeedProcessing.length }).log('Photos need embedding')

      if (photosNeedProcessing.length === 0) {
        return Ok([])
      }

      // Build descriptions first so embedding can be batched in one request.
      const descriptionsToEmbed: Array<{ photoId: string, description: string }> = []

      for (const photo of photosNeedProcessing) {
        try {
          const hasDescription = photo.description && photo.description.trim() !== ''

          let description: string

          // Reuse existing description unless forceRefetch is requested.
          if (hasDescription && !opts.forceRefetch) {
            description = photo.description
            logger.withFields({ photoId: photo.id }).log('Using existing description')
          }
          else {
            if (!photo.image_bytes) {
              logger.withFields({ photoId: photo.id }).warn('Photo has no image bytes in database, skipping')
              continue
            }

            logger.withFields({
              photoId: photo.id,
              imageBytesLength: photo.image_bytes.length,
              imageBytesType: photo.image_bytes.constructor?.name,
            }).log('Generating description for photo')

            const descriptionResult = await describeImage(photo.image_bytes, visionLLM)
            ctx.metrics?.visionApiCall.inc({ status: descriptionResult.orUndefined() != null ? 'success' : 'error' })
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

      // Batch embedding reduces latency and request overhead.
      logger.withFields({ count: descriptionsToEmbed.length }).log('Generating embeddings for photos')

      const descriptions = descriptionsToEmbed.map(d => d.description)
      const embedResult = await embedContents(descriptions, embedding)
      ctx.metrics?.embeddingApiCall.inc({ status: embedResult.orUndefined() != null ? 'success' : 'error' })
      const { embeddings } = embedResult.expect('Failed to generate embeddings')
      const validDimension = EMBEDDING_DIMENSION_TO_VECTOR_DIMENSION[embedding.dimension]

      // Persist generated descriptions and vectors.
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
