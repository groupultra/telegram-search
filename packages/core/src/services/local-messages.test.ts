import type { Logger } from '@guiiai/logg'

import type { CoreDB } from '../db'
import type { Models } from '../models'

import { Ok } from '@unbird/result'
import { describe, expect, it, vi } from 'vitest'

import { createLocalMessagesService } from './local-messages'

describe('local message query filters', () => {
  it('passes the requested sender to the database query', async () => {
    // The CLI exposed --sender, but the service previously discarded it.
    const fetchMessagesByTimeRange = vi.fn(async () => Ok([]))
    const service = createLocalMessagesService({
      db: {} as CoreDB,
      accountId: 'account-1',
      logger: {} as Logger,
      models: { chatMessageModels: { fetchMessagesByTimeRange } } as unknown as Models,
    })

    await service.query({
      chatIds: ['chat-1'],
      fromUserId: 'user-1',
      from: 10,
      to: 20,
      limit: 100,
    })

    expect(fetchMessagesByTimeRange).toHaveBeenCalledWith(
      expect.anything(),
      'account-1',
      { start: 10, end: 20 },
      ['chat-1'],
      { offset: 0, limit: 101 },
      'user-1',
    )
  })
})
