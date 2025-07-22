import type { CoreMessage } from '@tg-search/core'
import type { MockedFunction } from 'vitest'

import { v4 as uuidv4 } from 'uuid'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MessageWindow } from './useMessageWindow'

import * as blobUtils from '../utils/blob'

// Mock the blob utilities
vi.mock('../utils/blob', () => ({
  cleanupMediaBlobs: vi.fn(),
}))

const mockedCleanupMediaBlobs = blobUtils.cleanupMediaBlobs as MockedFunction<typeof blobUtils.cleanupMediaBlobs>

describe('messageWindow', () => {
  let messageWindow: MessageWindow

  const createMockMessage = (id: string, hasMedia = false): CoreMessage => ({
    uuid: uuidv4(),
    platform: 'telegram',
    platformMessageId: id,
    chatId: '',
    fromId: '',
    fromName: '',
    content: '',
    media: hasMedia ? [{ type: 'photo', mimeType: 'image/jpeg', blobUrl: 'blob:test' } as any] : undefined,
    reply: {} as any,
    forward: {} as any,
    vectors: {} as any,
    jiebaTokens: [],
    platformTimestamp: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: undefined,
  })

  beforeEach(() => {
    messageWindow = new MessageWindow(3) // Small size for easier testing
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  describe('constructor', () => {
    it('should initialize with default maxSize of 50', () => {
      const defaultWindow = new MessageWindow()
      expect(defaultWindow.maxSize).toBe(50)
    })

    it('should initialize with custom maxSize', () => {
      expect(messageWindow.maxSize).toBe(3)
    })

    it('should initialize with default values', () => {
      expect(messageWindow.messages.size).toBe(0)
      expect(messageWindow.minId).toBe(Infinity)
      expect(messageWindow.maxId).toBe(-Infinity)
      expect(messageWindow.lastAccessTime).toBeCloseTo(Date.now(), -2)
    })
  })

  describe('addBatch', () => {
    it('should add messages and update boundaries', () => {
      const messages = [
        createMockMessage('10'),
        createMockMessage('20'),
        createMockMessage('15'),
      ]

      messageWindow.addBatch(messages)

      expect(messageWindow.messages.size).toBe(3)
      expect(messageWindow.minId).toBe(10)
      expect(messageWindow.maxId).toBe(20)
    })

    it('should handle empty array', () => {
      messageWindow.addBatch([])

      expect(messageWindow.messages.size).toBe(0)
      expect(messageWindow.minId).toBe(Infinity)
      expect(messageWindow.maxId).toBe(-Infinity)
    })

    it('should sort messages by platformMessageId', () => {
      const messages = [
        createMockMessage('30'),
        createMockMessage('10'),
        createMockMessage('20'),
      ]

      messageWindow.addBatch(messages)

      const sortedIds = messageWindow.getSortedIds()
      expect(sortedIds).toEqual(['10', '20', '30'])
    })

    it('should update lastAccessTime', () => {
      const beforeTime = Date.now()
      const messages = [createMockMessage('10')]

      messageWindow.addBatch(messages)

      expect(messageWindow.lastAccessTime).toBeGreaterThanOrEqual(beforeTime)
    })
  })

  describe('cleanup behavior', () => {
    it('should remove newest messages when direction is "older"', () => {
      // Add 4 messages (exceeds maxSize of 3)
      const messages = [
        createMockMessage('10'),
        createMockMessage('20'),
        createMockMessage('30'),
        createMockMessage('40'),
      ]

      messageWindow.addBatch(messages, 'older')

      expect(messageWindow.messages.size).toBe(3)
      expect(messageWindow.has('10')).toBe(true)
      expect(messageWindow.has('20')).toBe(true)
      expect(messageWindow.has('30')).toBe(true)
      expect(messageWindow.has('40')).toBe(false) // Newest should be removed
      expect(messageWindow.minId).toBe(10)
      expect(messageWindow.maxId).toBe(30)
    })

    it('should remove oldest messages when direction is "newer"', () => {
      // Add 4 messages (exceeds maxSize of 3)
      const messages = [
        createMockMessage('10'),
        createMockMessage('20'),
        createMockMessage('30'),
        createMockMessage('40'),
      ]

      messageWindow.addBatch(messages, 'newer')

      expect(messageWindow.messages.size).toBe(3)
      expect(messageWindow.has('10')).toBe(false) // Oldest should be removed
      expect(messageWindow.has('20')).toBe(true)
      expect(messageWindow.has('30')).toBe(true)
      expect(messageWindow.has('40')).toBe(true)
      expect(messageWindow.minId).toBe(20)
      expect(messageWindow.maxId).toBe(40)
    })

    it('should remove oldest messages when direction is "initial"', () => {
      // Add 4 messages (exceeds maxSize of 3)
      const messages = [
        createMockMessage('10'),
        createMockMessage('20'),
        createMockMessage('30'),
        createMockMessage('40'),
      ]

      messageWindow.addBatch(messages, 'initial')

      expect(messageWindow.messages.size).toBe(3)
      expect(messageWindow.has('10')).toBe(false) // Oldest should be removed
      expect(messageWindow.has('20')).toBe(true)
      expect(messageWindow.has('30')).toBe(true)
      expect(messageWindow.has('40')).toBe(true)
    })

    it('should cleanup media blobs when removing messages', () => {
      const messagesWithMedia = [
        createMockMessage('10', true),
        createMockMessage('20', true),
        createMockMessage('30', true),
        createMockMessage('40', true), // This will be removed
      ]

      messageWindow.addBatch(messagesWithMedia, 'newer')

      expect(mockedCleanupMediaBlobs).toHaveBeenCalledWith(messagesWithMedia[0].media)
    })
  })

  describe('get', () => {
    it('should return message if exists', () => {
      const message = createMockMessage('10')
      messageWindow.addBatch([message])

      const result = messageWindow.get('10')
      expect(result).toEqual(message)
    })

    it('should return undefined if message does not exist', () => {
      const result = messageWindow.get('999')
      expect(result).toBeUndefined()
    })

    it('should update lastAccessTime', () => {
      const message = createMockMessage('10')
      messageWindow.addBatch([message])
      const beforeTime = Date.now()

      messageWindow.get('10')

      expect(messageWindow.lastAccessTime).toBeGreaterThanOrEqual(beforeTime)
    })
  })

  describe('has', () => {
    it('should return true if message exists', () => {
      const message = createMockMessage('10')
      messageWindow.addBatch([message])

      expect(messageWindow.has('10')).toBe(true)
    })

    it('should return false if message does not exist', () => {
      expect(messageWindow.has('999')).toBe(false)
    })
  })

  describe('getSortedIds', () => {
    it('should return sorted message IDs', () => {
      const messages = [
        createMockMessage('30'),
        createMockMessage('10'),
        createMockMessage('20'),
      ]
      messageWindow.addBatch(messages)

      const sortedIds = messageWindow.getSortedIds()
      expect(sortedIds).toEqual(['10', '20', '30'])
    })

    it('should return empty array when no messages', () => {
      const sortedIds = messageWindow.getSortedIds()
      expect(sortedIds).toEqual([])
    })
  })

  describe('size', () => {
    it('should return current message count', () => {
      expect(messageWindow.size()).toBe(0)

      const messages = [createMockMessage('10'), createMockMessage('20')]
      messageWindow.addBatch(messages)

      expect(messageWindow.size()).toBe(2)
    })
  })

  describe('clear', () => {
    it('should clear all messages', () => {
      const messages = [
        createMockMessage('10'),
        createMockMessage('20'),
      ]
      messageWindow.addBatch(messages)

      messageWindow.clear()

      expect(messageWindow.messages.size).toBe(0)
      expect(messageWindow.minId).toBe(Infinity)
      expect(messageWindow.maxId).toBe(-Infinity)
    })

    it('should cleanup media blobs when clearing', () => {
      const messagesWithMedia = [
        createMockMessage('10', true),
        createMockMessage('20', true),
      ]
      messageWindow.addBatch(messagesWithMedia)

      messageWindow.clear()

      expect(mockedCleanupMediaBlobs).toHaveBeenCalledTimes(2)
      expect(mockedCleanupMediaBlobs).toHaveBeenCalledWith(messagesWithMedia[0].media)
      expect(mockedCleanupMediaBlobs).toHaveBeenCalledWith(messagesWithMedia[1].media)
    })

    it('should update lastAccessTime', () => {
      const beforeTime = Date.now()
      messageWindow.clear()

      expect(messageWindow.lastAccessTime).toBeGreaterThanOrEqual(beforeTime)
    })
  })

  describe('boundary updates after cleanup', () => {
    it('should reset boundaries when all messages are removed', () => {
      const message = createMockMessage('10')
      messageWindow.addBatch([message])

      messageWindow.clear()

      expect(messageWindow.minId).toBe(Infinity)
      expect(messageWindow.maxId).toBe(-Infinity)
    })

    it('should update boundaries correctly after partial cleanup', () => {
      const messages = [
        createMockMessage('10'),
        createMockMessage('20'),
        createMockMessage('30'),
        createMockMessage('40'),
      ]

      messageWindow.addBatch(messages, 'newer') // Should remove oldest (10)

      expect(messageWindow.minId).toBe(20)
      expect(messageWindow.maxId).toBe(40)
    })
  })
})
