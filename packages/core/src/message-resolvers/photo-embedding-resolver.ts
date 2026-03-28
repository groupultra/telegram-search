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

      // Skip expensive vision/embedding calls unless photo embedding is explicitly enabled.
      if (!messageProcessing?.enablePhotoEmbedding) {
        return Ok([])
      }

      // Guard against misconfiguration before hitting remote APIs.
      if (!visionLLM.apiKey || visionLLM.apiKey.trim() === '') {
        return Ok([])
      }

      // Guard against misconfiguration before hitting remote APIs.
      if (!embedding.apiKey || embedding.apiKey.trim() === '') {
        return Ok([])
      }

      const db = ctx.getDB()
      const messageUUIDs = opts.messages.map(m => m.uuid)

      if (messageUUIDs.length === 0) {
        return Ok([])
      }

      // Media resolver runs first, so target photos should already be persisted.
      const photosToProcess = await photoModels.findPhotosByMessageUUIDs(db, messageUUIDs)
        .then(result => result.orDefault([]))

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
          }
          else {
            if (!photo.image_bytes) {
              continue
            }

            const descriptionResult = await describeImage(photo.image_bytes, visionLLM)
            ctx.metrics?.visionApiCall.inc({ status: descriptionResult.orUndefined() != null ? 'success' : 'error' })
            const desc = descriptionResult.expect('Failed to generate description')

            description = desc.description
          }

          descriptionsToEmbed.push({ photoId: photo.id, description })
        }
        catch (error) {
          logger.withFields({ photoId: photo.id }).withError(error as Error).warn('Failed to process photo')
        }
      }

      if (descriptionsToEmbed.length === 0) {
        return Ok([])
      }

      // Batch embedding reduces latency and request overhead.
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
          continue
        }

        try {
          await photoModels.updatePhotoEmbedding(db, photoId, {
            description,
            vector,
            dimension: validDimension,
          })
        }
        catch (error) {
          logger.withFields({ photoId }).withError(error as Error).warn('Failed to update photo embedding')
        }
      }

      return Ok(opts.messages)
    },
  }
}
