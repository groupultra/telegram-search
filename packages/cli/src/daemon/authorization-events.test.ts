import type { CoreContext } from '@tg-search/core'
import type { DaemonStatus } from '@tg-search/protocol'

import { EventEmitter } from 'node:events'

import { CoreEventType } from '@tg-search/core'
import { describe, expect, it } from 'vitest'

import { registerDaemonAuthorizationHandlers } from './authorization-events'
import { createDaemonDiagnostics } from './diagnostics'

function harness() {
  const emitter = new EventEmitter() as CoreContext['emitter']
  const diagnostics = createDaemonDiagnostics()
  let active = true
  let state: DaemonStatus['state'] = 'starting'
  let error: string | undefined
  registerDaemonAuthorizationHandlers({ emitter }, {
    isActiveContext: () => active,
    diagnostics,
    onState(nextState, nextError) {
      state = nextState
      error = nextError
    },
  })
  return {
    emitter,
    diagnostics,
    status: () => ({ state, error }),
    deactivate: () => {
      active = false
    },
  }
}

describe('daemon authorization event evidence', () => {
  it('does not infer expired credentials from the generic AuthError emitted after a network login failure', () => {
    // ConnectionService emits AuthError for every rejected login, including
    // ENETUNREACH. Only AuthDisconnected provides explicit authorization evidence.
    const { emitter, diagnostics, status } = harness()
    diagnostics.transport('disconnected')
    emitter.emit(CoreEventType.AuthError)
    expect(diagnostics.snapshot()).toMatchObject({ transport: { state: 'disconnected' }, authorization: { state: 'unknown' } })
    expect(status()).toEqual({ state: 'error', error: 'Telegram session initialization failed' })
  })

  it('records unauthorized only after an explicit AuthDisconnected event', () => {
    const { emitter, diagnostics, status } = harness()
    diagnostics.transport('connected')
    emitter.emit(CoreEventType.AuthError)
    emitter.emit(CoreEventType.AuthDisconnected)
    expect(diagnostics.snapshot()).toMatchObject({ transport: { state: 'disconnected' }, authorization: { state: 'unauthorized' } })
    expect(status()).toEqual({ state: 'unauthorized', error: undefined })
  })

  it('ignores old runtime authorization events after replacement', () => {
    const { emitter, diagnostics, status, deactivate } = harness()
    diagnostics.authorization('authorized')
    deactivate()
    emitter.emit(CoreEventType.AuthError)
    emitter.emit(CoreEventType.AuthDisconnected)
    expect(diagnostics.snapshot().authorization.state).toBe('authorized')
    expect(status()).toEqual({ state: 'starting', error: undefined })
  })
})
