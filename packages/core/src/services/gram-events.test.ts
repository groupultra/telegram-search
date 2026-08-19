import { EventEmitter } from 'eventemitter3'
import { Raw } from 'telegram/events/Raw'
import { UpdateConnectionState } from 'telegram/network'
import { describe, expect, it, vi } from 'vitest'

import { CoreEventType } from '../types/events'
import { createGramEventsService } from './gram-events'

function createLogger() {
  const logger = {
    withContext: vi.fn(),
    debug: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    withError: vi.fn(),
  }
  logger.withContext.mockReturnValue(logger)
  logger.withError.mockReturnValue(logger)
  return logger
}

describe('gram events service', () => {
  it('triggers one pts catch-up after Telegram reconnects', async () => {
    const handlers: Array<{ callback: (event: unknown) => void, event: unknown }> = []
    const client = {
      addEventHandler: vi.fn((callback, event) => handlers.push({ callback, event })),
      removeEventHandler: vi.fn(),
    }
    const emitter = new EventEmitter()
    const context = { emitter, getClient: () => client }
    const service = createGramEventsService(context as never, createLogger() as never)
    const catchUp = vi.fn()
    const states: string[] = []
    emitter.on(CoreEventType.SyncCatchUp, catchUp)
    emitter.on(CoreEventType.GramConnectionState, ({ state }) => states.push(state))

    service.registerGramEvents()
    const handler = handlers.find(({ event }) => event instanceof Raw)?.callback
    expect(handler).toBeDefined()

    handler!(new UpdateConnectionState(UpdateConnectionState.connected))
    handler!(new UpdateConnectionState(UpdateConnectionState.disconnected))
    handler!(new UpdateConnectionState(UpdateConnectionState.connected))
    handler!(new UpdateConnectionState(UpdateConnectionState.connected))

    expect(catchUp).toHaveBeenCalledOnce()
    expect(states).toEqual(['connected', 'disconnected', 'connected', 'connected'])
  })
})
