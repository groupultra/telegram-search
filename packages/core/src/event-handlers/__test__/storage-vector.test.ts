import type { Models } from '../../models'

import { useLogger } from '@guiiai/logg'
import { Ok } from '@unbird/result'
import { describe, expect, it, vi } from 'vitest'

import { getMockEmptyDB } from '../../../mock'
import { createCoreContext } from '../../context'
import { CoreEventType } from '../../types/events'
import { embedContents } from '../../utils/embed'
import { registerStorageEventHandlers } from '../storage'

vi.mock('../../utils/embed', () => ({ embedContents: vi.fn() }))

const logger = useLogger()

describe('storage search with vector search disabled', () => {
  it('falls back to text retrieval without calling the embedding API', async () => {
    // Without vector indexes a similarity query scans every stored vector, so useVector must be ignored.
    const retrieveMessages = vi.fn(async (..._args: unknown[]) => Ok([]))
    const models = {
      chatMessageModels: { retrieveMessages },
      accountSettingsModels: { fetchSettingsByAccountId: vi.fn(async () => Ok({})) },
      systemSettingsModels: { getVectorSettings: vi.fn(async () => Ok({ enabled: false })) },
    } as unknown as Models
    const ctx = createCoreContext(getMockEmptyDB, models, logger)
    ctx.setCurrentAccountId('account-vector-off')
    registerStorageEventHandlers(ctx, logger, models)

    const done = new Promise<void>(resolve => ctx.emitter.on(CoreEventType.StorageSearchMessagesData, () => resolve()))
    ctx.emitter.emit(CoreEventType.StorageSearchMessages, { content: 'project', useVector: true, pagination: { limit: 10, offset: 0 } })
    await done

    expect(embedContents).not.toHaveBeenCalled()
    expect(retrieveMessages).toHaveBeenCalledOnce()
    // retrieveMessages(db, logger, accountId, dimension, content, pagination, filters)
    expect(retrieveMessages.mock.calls[0][4]).toEqual({ model: 'text-embedding-3-small', text: 'project' })
  })
})
