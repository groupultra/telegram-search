import type { Logger } from '@guiiai/logg'

import type { MessageResolver, MessageResolverOpts } from '.'
import type { CoreContext } from '../context'
import type { PhotoModels } from '../models/photos'
import type { DBSelectPhoto } from '../models/utils/types'
import type { VisionLLMConfig } from '../types/account-settings'
import type { MediaBinaryProvider } from '../types/storage'

import { newQueue } from '@henrygd/queue'
import { Ok } from '@unbird/result'

import { systemSettingsModels } from '../models/system-settings'
import { embedContents } from '../utils/embed'
import { describeImage } from '../utils/vision'

const VISION_CONCURRENCY = 3

function hasDescriptionVector(photo: DBSelectPhoto): boolean {
  return Boolean(
    photo.description_vector_1536?.length
    || photo.description_vector_1024?.length
    || photo.description_vector_768?.length,
  )
}

/**
 * Describes photos with a vision model and embeds the descriptions for semantic image search.
 *
 * Must run after the media resolver, which persists the photos (see message-resolver service).
 */
export function createPhotoEmbeddingResolver(
  ctx: CoreContext,
  logger: Logger,
  photoModels: PhotoModels,
  mediaBinaryProvider: MediaBinaryProvider | undefined,
): MessageResolver {
  logger = logger.withContext('core:resolver:photo-embedding')

  const visionQueue = newQueue(VISION_CONCURRENCY)

  // Photos live inline in the database or behind the media storage provider (MinIO, local disk, OPFS).
  async function loadImageBytes(photo: DBSelectPhoto): Promise<Uint8Array | undefined> {
    if (photo.image_bytes) {
      return photo.image_bytes
    }

    if (photo.image_path && mediaBinaryProvider) {
      return await mediaBinaryProvider.load({ kind: 'photo', path: photo.image_path }) ?? undefined
    }

    return undefined
  }

  async function describePhoto(photo: DBSelectPhoto, visionLLM: VisionLLMConfig, forceRefetch: boolean): Promise<string | undefined> {
    // Reuse existing description unless forceRefetch is requested.
    if (photo.description.trim() && !forceRefetch) {
      return photo.description
    }

    const bytes = await loadImageBytes(photo)
    if (!bytes) {
      logger.withFields({ photoId: photo.id }).debug('Photo bytes are not available, skipping')
      return undefined
    }

    const description = (await describeImage({ bytes, mimeType: photo.image_mime_type }, visionLLM)).orUndefined()
    ctx.metrics?.visionApiCall.inc({ status: description != null ? 'success' : 'error' })
    if (description == null) {
      logger.withFields({ photoId: photo.id }).warn('Failed to describe photo')
      return undefined
    }

    (await photoModels.updatePhotoEmbedding(ctx.getDB(), photo.id, { description })).expect('Failed to save photo description')
    return description
  }

  return {
    run: async (opts: MessageResolverOpts) => {
      const { visionLLM, embedding, messageProcessing } = await ctx.getAccountSettings()

      // Skip expensive vision/embedding calls unless photo embedding is enabled and both APIs are configured.
      if (!messageProcessing?.enablePhotoEmbedding || !visionLLM.apiKey.trim() || !embedding.apiKey.trim()) {
        return Ok([])
      }

      // The database-wide vector switch wins over per-account photo embedding settings.
      const vector = (await systemSettingsModels.getVectorSettings(ctx.getDB())).expect('Failed to read vector settings')
      if (!vector.enabled) {
        return Ok([])
      }

      const messageUUIDs = opts.messages.map(message => message.uuid)
      if (messageUUIDs.length === 0) {
        return Ok([])
      }

      const db = ctx.getDB()

      // Media resolver runs first, so target photos should already be persisted.
      // Re-process only when forced or when no vector exists yet.
      const photos = (await photoModels.findPhotosByMessageUUIDs(db, messageUUIDs)).orDefault([]).filter(photo => opts.forceRefetch || !hasDescriptionVector(photo))

      if (photos.length === 0) {
        return Ok([])
      }

      const described = (await Promise.all(photos.map(photo => visionQueue.add(async () => {
        try {
          return { photo, description: await describePhoto(photo, visionLLM, opts.forceRefetch ?? false) }
        }
        catch (error) {
          logger.withFields({ photoId: photo.id }).withError(error).warn('Failed to process photo')
          return { photo, description: undefined }
        }
      }))))
        .filter((item): item is { photo: DBSelectPhoto, description: string } => item.description != null)

      for (let i = 0; i < described.length; i += embedding.batchSize) {
        const batch = described.slice(i, i + embedding.batchSize)
        const embedResult = await embedContents(batch.map(item => item.description), embedding)
        ctx.metrics?.embeddingApiCall.inc({ status: embedResult.orUndefined() != null ? 'success' : 'error' })
        const { embeddings } = embedResult.expect('Failed to embed photo descriptions')

        await Promise.all(batch.map(async ({ photo, description }, index) => {
          const vector = embeddings[index]
          if (!vector) {
            return
          }

          const result = await photoModels.updatePhotoEmbedding(db, photo.id, {
            description,
            embedding: { vector, dimension: embedding.dimension },
          })
          if (result.orUndefined() == null) {
            logger.withFields({ photoId: photo.id }).warn('Failed to update photo embedding')
          }
        }))
      }

      // Vectors are stored on the photos table; the messages themselves are unchanged.
      return Ok([])
    },
  }
}
