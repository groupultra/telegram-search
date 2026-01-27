import type { Models } from '../../models'

import bigInt from 'big-integer'

import { useLogger } from '@guiiai/logg'
import { Api } from 'telegram'
import { describe, expect, it, vi } from 'vitest'

import { getMockEmptyDB } from '../../../mock'
import { createCoreContext } from '../../context'
import { CoreEventType } from '../../types/events'
import { registerMessageEventHandlers } from '../message'

const models = {} as unknown as Models
const logger = useLogger()

describe('message event handlers', () => {
  it('message:reprocess should fetch messages and emit message:process with forceRefetch', async () => {
    const ctx = createCoreContext(getMockEmptyDB, models, logger)

    // Mock message service
    const mockMessages = [
      new Api.Message({
        id: 123,
        peerId: new Api.PeerUser({ userId: bigInt(456) }),
        message: 'Test message',
        date: Math.floor(Date.now() / 1000),
      }),
    ]

    const mockMessageService = {
      fetchSpecificMessages: vi.fn(async (_chatId: string, _messageIds: number[]) => {
        return mockMessages
      }),
    }

    // Register handlers
    const registerHandlers = registerMessageEventHandlers(ctx, logger)
    registerHandlers(mockMessageService as any)

    // Set up listener for message:process to capture forceRefetch flag
    let capturedForceRefetch: boolean | undefined
    ctx.emitter.on(CoreEventType.MessageProcess, ({ forceRefetch }) => {
      capturedForceRefetch = forceRefetch
    })

    // Emit message:reprocess event
    ctx.emitter.emit(CoreEventType.MessageReprocess, {
      chatId: '789',
      messageIds: [123],
      resolvers: ['media'],
    })

    // Wait for async handlers to complete
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify forceRefetch flag is set to true
    expect(mockMessageService.fetchSpecificMessages).toHaveBeenCalledWith('789', [123])
    expect(capturedForceRefetch).toBe(true)
  })

  it('message:reprocess should handle fetch errors gracefully', async () => {
    const ctx = createCoreContext(getMockEmptyDB, models, logger)

    // Mock message service that throws error
    const mockMessageService = {
      fetchSpecificMessages: vi.fn(async () => {
        throw new Error('Failed to fetch messages')
      }),
    }

    // Register handlers
    const registerHandlers = registerMessageEventHandlers(ctx, logger)
    registerHandlers(mockMessageService as any)

    // Set up listener for core:error
    const errors: any[] = []
    ctx.emitter.on(CoreEventType.CoreError, (error) => {
      errors.push(error)
    })

    // Emit message:reprocess event
    ctx.emitter.emit(CoreEventType.MessageReprocess, {
      chatId: '789',
      messageIds: [123],
      resolvers: ['media'],
    })

    // Wait for async handlers to complete
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify error was emitted
    expect(mockMessageService.fetchSpecificMessages).toHaveBeenCalledWith('789', [123])
    expect(errors).toHaveLength(1)
    expect(errors[0].description).toBe('Failed to re-process messages')
  })

  it('message:reprocess should not emit message:process if no messages found', async () => {
    const ctx = createCoreContext(getMockEmptyDB, models, logger)

    // Mock message service that returns empty array
    const mockMessageService = {
      fetchSpecificMessages: vi.fn(async () => {
        return []
      }),
    }

    // Register handlers
    const registerHandlers = registerMessageEventHandlers(ctx, logger)
    registerHandlers(mockMessageService as any)

    // Set up listener for message:process
    const processedMessages: Api.Message[] = []
    ctx.emitter.on(CoreEventType.MessageProcess, ({ messages }) => {
      processedMessages.push(...messages)
    })

    // Emit message:reprocess event
    ctx.emitter.emit(CoreEventType.MessageReprocess, {
      chatId: '789',
      messageIds: [123],
      resolvers: ['media'],
    })

    // Wait for async handlers to complete
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify no messages were processed
    expect(mockMessageService.fetchSpecificMessages).toHaveBeenCalledWith('789', [123])
    expect(processedMessages).toHaveLength(0)
  })
})
