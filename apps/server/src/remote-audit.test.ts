import { describe, expect, it } from 'vitest'

import { mockDB } from '../../../packages/core/src/db/mock'
import { remoteAuditEventsTable } from '../../../packages/core/src/schemas/remote-audit-events'
import { createRemoteAuditRecorder } from './remote-audit'

describe('remote audit recorder', () => {
  it('persists an append-only, sanitized operation record', async () => {
    const db = await mockDB({ remoteAuditEventsTable })
    const record = createRemoteAuditRecorder(db)

    await record({
      requestId: 'request-1',
      credentialId: '22222222-2222-4222-8222-222222222222',
      credentialName: 'project-reader',
      accountId: '11111111-1111-4111-8111-111111111111',
      method: 'messages.search',
      chatIds: ['7'],
      decision: 'allowed',
      outcome: 'success',
      requestSummary: { limit: 10, queryLength: 15, queryHash: 'a'.repeat(64) },
      resultSummary: { itemCount: 2 },
      durationMs: 12,
      userAgent: 'test-client',
    })

    const rows = await db.select().from(remoteAuditEventsTable)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      request_id: 'request-1',
      credential_name: 'project-reader',
      method: 'messages.search',
      chat_ids: ['7'],
      decision: 'allowed',
      outcome: 'success',
      request_summary: { limit: 10, queryLength: 15, queryHash: 'a'.repeat(64) },
      result_summary: { itemCount: 2 },
      duration_ms: 12,
      user_agent: 'test-client',
    })
  })
})
