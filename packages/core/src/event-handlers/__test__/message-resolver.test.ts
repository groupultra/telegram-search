import type { Models } from '../../models'
import type { MessageResolverService } from '../../services/message-resolver'

import bigInt from 'big-integer'

import { useLogger } from '@guiiai/logg'
import { Api } from 'telegram'
import { describe, expect, it, vi } from 'vitest'

import { getMockEmptyDB } from '../../../mock'
import { createCoreContext } from '../../context'
import { CoreEventType } from '../../types/events'
import { registerMessageResolverEventHandlers } from '../message-resolver'

const models = {} as unknown as Models
const logger = useLogger()

describe('message-resolver event handlers', () => {
  it('should forward forceRefetch to messageResolverService for realtime messages', async () => {
    const ctx = createCoreContext(getMockEmptyDB, models, logger)

    const service: MessageResolverService = {
      processMessages: vi.fn(async () => {
        // noop
      }),
    } as unknown as MessageResolverService

    const registerHandlers = registerMessageResolverEventHandlers(ctx, logger)
    registerHandlers(service)

    const telegramMessage = new Api.Message({
      id: 123,
      peerId: new Api.PeerUser({ userId: bigInt(456) }),
      message: 'Test message',
      date: Math.floor(Date.now() / 1000),
    })

    ctx.emitter.emit(CoreEventType.MessageProcess, {
      messages: [telegramMessage],
      isTakeout: false,
      forceRefetch: true,
    })

    // Wait for async handler to complete
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(service.processMessages).toHaveBeenCalledTimes(1)
    const [, options] = (service.processMessages as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(options).toMatchObject({
      takeout: false,
      forceRefetch: true,
    })
  })

  it('should forward forceRefetch to messageResolverService in takeout mode via queue', async () => {
    const ctx = createCoreContext(getMockEmptyDB, models, logger)

    const service: MessageResolverService = {
      processMessages: vi.fn(async () => {
        // noop
      }),
    } as unknown as MessageResolverService

    const registerHandlers = registerMessageResolverEventHandlers(ctx, logger)
    registerHandlers(service)

    const telegramMessage = new Api.Message({
      id: 456,
      peerId: new Api.PeerUser({ userId: bigInt(789) }),
      message: 'Takeout message',
      date: Math.floor(Date.now() / 1000),
    })

    ctx.emitter.emit(CoreEventType.MessageProcess, {
      messages: [telegramMessage],
      isTakeout: true,
      forceRefetch: true,
    })

    // Wait for the queued task to run
    await new Promise(resolve => setTimeout(resolve, 10))

    expect(service.processMessages).toHaveBeenCalledTimes(1)
    const [, options] = (service.processMessages as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(options).toMatchObject({
      takeout: true,
      forceRefetch: true,
    })
  })
})
