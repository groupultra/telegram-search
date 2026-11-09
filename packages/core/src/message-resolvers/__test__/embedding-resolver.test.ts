import type { CoreContext } from '../../context'
import type { ProcessedCoreMessage } from '../../types/message'

import { useLogger } from '@guiiai/logg'
import { Ok } from '@unbird/result'
import { describe, expect, it, vi } from 'vitest'

import { systemSettingsModels } from '../../models/system-settings'
import { embedContents } from '../../utils/embed'
import { createEmbeddingResolver } from '../embedding-resolver'

vi.mock('../../utils/embed', () => ({ embedContents: vi.fn() }))
vi.mock('../../models/system-settings', () => ({ systemSettingsModels: { getVectorSettings: vi.fn() } }))

describe('embedding resolver', () => {
  it('skips embedding when vector search is disabled even if an API key is configured', async () => {
    vi.mocked(systemSettingsModels.getVectorSettings).mockResolvedValue(Ok({ enabled: false }))
    const getAccountSettings = vi.fn(async () => ({ embedding: { apiKey: 'configured', model: 'text-embedding-3-small', batchSize: 10 } }))
    const ctx = { getDB: () => ({}), getAccountSettings } as unknown as CoreContext

    const result = await createEmbeddingResolver(ctx, useLogger()).run!({ messages: [{ content: 'hello' } as ProcessedCoreMessage], rawMessages: [] } as never)

    expect(result.unwrap()).toEqual([])
    expect(embedContents).not.toHaveBeenCalled()
    expect(getAccountSettings).not.toHaveBeenCalled()
  })
})
