import type { CoreDB } from '@tg-search/core'

import type { RemoteAuditEvent } from './remote'

import { remoteAuditEventsTable } from '@tg-search/core'

export function createRemoteAuditRecorder(db: CoreDB) {
  return async function recordRemoteAuditEvent(event: RemoteAuditEvent): Promise<void> {
    await db.insert(remoteAuditEventsTable).values({
      request_id: event.requestId,
      credential_id: event.credentialId,
      credential_name: event.credentialName,
      account_id: event.accountId,
      method: event.method,
      chat_ids: event.chatIds,
      decision: event.decision,
      outcome: event.outcome,
      error_code: event.errorCode,
      request_summary: event.requestSummary,
      result_summary: event.resultSummary,
      duration_ms: event.durationMs,
      user_agent: event.userAgent,
    })
  }
}
