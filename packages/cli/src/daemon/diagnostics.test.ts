import { describe, expect, it } from 'vitest'

import { createDaemonDiagnostics } from './diagnostics'

describe('independent daemon health (issue #682)', () => {
  it('keeps a successful live read separate from a failed historical catch-up', () => {
    let now = 10
    const diagnostics = createDaemonDiagnostics(() => now)
    diagnostics.transport('connected')
    diagnostics.authorization('authorized')
    now = 20
    diagnostics.catchUp('failed', 'historical gap')
    now = 30
    diagnostics.read('telegram', { ok: true, data: [] })
    expect(diagnostics.snapshot()).toMatchObject({
      transport: { state: 'connected', changedAt: 10, lastSuccessAt: 10 },
      authorization: { state: 'authorized' },
      catchUp: { state: 'failed', error: 'historical gap', changedAt: 20 },
      reads: { telegram: { state: 'available', lastSuccessAt: 30 }, local: { state: 'unknown' } },
    })
  })

  it('counts actual recovery attempts and preserves their completion times', () => {
    let now = 100
    const diagnostics = createDaemonDiagnostics(() => now)
    diagnostics.recoveryStarted()
    expect(diagnostics.snapshot().recovery).toEqual({ attempts: 1, inProgress: true, lastAttemptAt: 100 })
    now = 200
    diagnostics.recoveryFinished(true)
    diagnostics.recoveryStarted()
    now = 300
    diagnostics.recoveryFinished(false)
    expect(diagnostics.snapshot().recovery).toEqual({ attempts: 2, inProgress: false, lastAttemptAt: 200, lastSuccessAt: 200 })
  })
})
