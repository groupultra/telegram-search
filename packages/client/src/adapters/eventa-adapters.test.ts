import { describe, expect, it } from 'vitest'

import { createLocalApplicationBridge } from './eventa-local'
import { createWebSocketApplicationBridge } from './eventa-websocket'

describe('eventa application adapters', () => {
  it('exposes the same application invoke surface in local and WebSocket modes', () => {
    const local = createLocalApplicationBridge(() => {
      throw new Error('not invoked')
    })
    const remote = createWebSocketApplicationBridge(() => undefined)
    const applicationKeys = [
      'listChats',
      'listRemoteMessages',
      'queryLocalMessages',
      'searchLocalMessages',
      'getLocalMessageContext',
      'getLocalStats',
    ]

    expect(applicationKeys.every(key => typeof local[key as keyof typeof local] === 'function')).toBe(true)
    expect(applicationKeys.every(key => typeof remote[key as keyof typeof remote] === 'function')).toBe(true)
  })
})
