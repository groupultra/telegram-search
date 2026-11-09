import type { CoreContext } from '../../context'
import type { PhotoModels } from '../../models/photos'
import type { DBSelectPhoto } from '../../models/utils/types'
import type { MediaBinaryProvider } from '../../types/storage'

import { Buffer } from 'node:buffer'

import { useLogger } from '@guiiai/logg'
import { Err, Ok } from '@unbird/result'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EmbeddingDimension } from '../../types/account-settings'
import { embedContents } from '../../utils/embed'
import { describeImage } from '../../utils/vision'
import { createPhotoEmbeddingResolver } from '../photo-embedding-resolver'

vi.mock('../../utils/vision', () => ({ describeImage: vi.fn() }))
vi.mock('../../utils/embed', () => ({ embedContents: vi.fn() }))
vi.mock('../../models/system-settings', () => ({
  systemSettingsModels: { getVectorSettings: vi.fn(async () => Ok({ enabled: true })) },
}))

function createPhoto(overrides: Partial<DBSelectPhoto>): DBSelectPhoto {
  return {
    id: 'photo-1',
    image_bytes: null,
    image_path: '',
    image_mime_type: 'image/png',
    description: '',
    description_vector_1536: null,
    description_vector_1024: null,
    description_vector_768: null,
    ...overrides,
  } as DBSelectPhoto
}

function createCtx(batchSize = 10, enablePhotoEmbedding = true) {
  return {
    getDB: () => ({}),
    getAccountSettings: async () => ({
      visionLLM: { apiKey: 'vision-key', apiBase: 'https://vision.local', model: 'vl' },
      embedding: { apiKey: 'embed-key', dimension: EmbeddingDimension.DIMENSION_768, batchSize },
      messageProcessing: { enablePhotoEmbedding },
    }),
  } as unknown as CoreContext
}

function createPhotoModels(photos: DBSelectPhoto[]) {
  return {
    findPhotosByMessageUUIDs: vi.fn(async () => Ok(photos)),
    updatePhotoEmbedding: vi.fn(async () => Ok({} as DBSelectPhoto)),
  } as unknown as PhotoModels & { updatePhotoEmbedding: ReturnType<typeof vi.fn> }
}

const opts = { messages: [{ uuid: 'msg-1' }] as any, rawMessages: [] }

describe('photo embedding resolver', () => {
  beforeEach(() => {
    vi.mocked(describeImage).mockReset().mockResolvedValue(Ok('a cat on a sofa'))
    vi.mocked(embedContents).mockReset().mockImplementation(async contents => Ok({ embeddings: contents.map(() => [0.1, 0.2]), dimension: 768 } as any))
  })

  it('loads photos kept in media storage instead of skipping them', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    const provider = { load: vi.fn(async () => bytes) } as unknown as MediaBinaryProvider
    const photoModels = createPhotoModels([createPhoto({ image_path: 'photo/abc' })])

    const result = (await createPhotoEmbeddingResolver(createCtx(), useLogger(), photoModels, provider).run!(opts)).unwrap()

    // Before the fix only inline image_bytes were read, but the server (MinIO or local disk)
    // and the browser (OPFS) store photos by path, so every photo was skipped.
    expect(provider.load).toHaveBeenCalledWith({ kind: 'photo', path: 'photo/abc' })
    expect(describeImage).toHaveBeenCalledWith({ bytes, mimeType: 'image/png' }, expect.anything())
    expect(photoModels.updatePhotoEmbedding).toHaveBeenLastCalledWith({}, 'photo-1', {
      description: 'a cat on a sofa',
      embedding: { vector: [0.1, 0.2], dimension: EmbeddingDimension.DIMENSION_768 },
    })
    // Photo vectors live on the photos table, so no messages are re-recorded.
    expect(result).toEqual([])
  })

  it('saves descriptions before embedding so a failed embedding does not waste vision calls', async () => {
    vi.mocked(embedContents).mockResolvedValue(Err('embedding down'))
    const photoModels = createPhotoModels([createPhoto({ image_bytes: Buffer.from([1]) as any })])
    const resolver = createPhotoEmbeddingResolver(createCtx(), useLogger(), photoModels, undefined)

    await expect(resolver.run!(opts)).rejects.toThrow()
    expect(photoModels.updatePhotoEmbedding).toHaveBeenCalledWith({}, 'photo-1', { description: 'a cat on a sofa' })
  })

  it('reuses stored descriptions and embeds in batches of embedding.batchSize', async () => {
    const photoModels = createPhotoModels([
      createPhoto({ id: 'p1', description: 'one' }),
      createPhoto({ id: 'p2', description: 'two' }),
      createPhoto({ id: 'p3', description: 'three' }),
      createPhoto({ id: 'p4', description: 'done', description_vector_768: [1] }),
    ])

    await createPhotoEmbeddingResolver(createCtx(2), useLogger(), photoModels, undefined).run!(opts)

    expect(describeImage).not.toHaveBeenCalled()
    expect(vi.mocked(embedContents).mock.calls.map(([contents]) => contents)).toEqual([['one', 'two'], ['three']])
  })

  it('does nothing when photo embedding is disabled', async () => {
    const photoModels = createPhotoModels([createPhoto({ image_bytes: Buffer.from([1]) as any })])

    await createPhotoEmbeddingResolver(createCtx(10, false), useLogger(), photoModels, undefined).run!(opts)

    expect(photoModels.findPhotosByMessageUUIDs).not.toHaveBeenCalled()
    expect(describeImage).not.toHaveBeenCalled()
  })
})
