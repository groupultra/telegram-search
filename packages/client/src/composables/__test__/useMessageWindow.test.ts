import type { CoreMessage } from '@tg-search/core'
import type { MockedFunction } from 'vitest'

import { v4 as uuidv4 } from 'uuid'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MessageWindow } from '../useMessageWindow'

import * as blobUtils from '../../utils/blob'

// Mock the blob utilities
vi.mock('../../utils/blob', () => ({
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
    media: hasMedia ? [{ type: 'photo', mimeType: 'image/jpeg', blobUrl: 'blob:test' }] : undefined,
    reply: {},
    forward: {},
    vectors: {},
    jiebaTokens: [],
    platformTimestamp: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: undefined,
  } as any)

  beforeEach(() => {
    messageWindow = new MessageWindow(3) // Small size for easier testing
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  describe('constructor', () => {
    it('should initialize with default maxSize of 50', () => {
      const defaultWindow = new MessageWindow()
      expect(defaultWindow.maxSize).toBe(50)
      expect(defaultWindow.trimThreshold).toBe(55)
    })

    it('should initialize with custom maxSize', () => {
      expect(messageWindow.maxSize).toBe(3)
      expect(messageWindow.trimThreshold).toBe(4)
    })

    it('should initialize with default values', () => {
      expect(messageWindow.messages.size).toBe(0)
      expect(messageWindow.pages).toEqual([])
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

    it('should track fetched batches as pages', () => {
      messageWindow.addBatch([createMockMessage('20'), createMockMessage('30')], 'initial')
      messageWindow.addBatch([createMockMessage('10')], 'older')
      messageWindow.addBatch([createMockMessage('40')], 'newer')

      expect(messageWindow.pages).toEqual([
        ['10'],
        ['20', '30'],
        ['40'],
      ])
    })
  })

  describe('cleanup behavior', () => {
    it('should delay cleanup until the trim threshold is exceeded', () => {
      const messages = [
        createMockMessage('10'),
        createMockMessage('20'),
        createMockMessage('30'),
        createMockMessage('40'),
      ]

      messageWindow.addBatch(messages, 'older')

      expect(messageWindow.messages.size).toBe(4)
      expect(messageWindow.has('40')).toBe(true)
    })

    it('should remove newest page when direction is "older" after crossing the trim threshold', () => {
      messageWindow.addBatch([
        createMockMessage('40'),
        createMockMessage('50'),
      ], 'initial')
      messageWindow.addBatch([
        createMockMessage('10'),
        createMockMessage('20'),
        createMockMessage('30'),
      ], 'older')

      expect(messageWindow.messages.size).toBe(3)
      expect(messageWindow.has('10')).toBe(true)
      expect(messageWindow.has('20')).toBe(true)
      expect(messageWindow.has('30')).toBe(true)
      expect(messageWindow.has('40')).toBe(false)
      expect(messageWindow.has('50')).toBe(false)
      expect(messageWindow.minId).toBe(10)
      expect(messageWindow.maxId).toBe(30)
    })

    it('should remove oldest page when direction is "newer" after crossing the trim threshold', () => {
      messageWindow.addBatch([
        createMockMessage('10'),
        createMockMessage('20'),
      ], 'older')
      messageWindow.addBatch([
        createMockMessage('30'),
        createMockMessage('40'),
        createMockMessage('50'),
      ], 'initial')

      expect(messageWindow.messages.size).toBe(3)
      expect(messageWindow.has('10')).toBe(false)
      expect(messageWindow.has('20')).toBe(false)
      expect(messageWindow.has('30')).toBe(true)
      expect(messageWindow.has('40')).toBe(true)
      expect(messageWindow.has('50')).toBe(true)
      expect(messageWindow.minId).toBe(30)
      expect(messageWindow.maxId).toBe(50)
    })

    it('should remove oldest page when direction is "initial" after crossing the trim threshold', () => {
      messageWindow.addBatch([
        createMockMessage('10'),
        createMockMessage('20'),
      ], 'initial')
      messageWindow.addBatch([
        createMockMessage('30'),
        createMockMessage('40'),
        createMockMessage('50'),
      ], 'initial')

      expect(messageWindow.messages.size).toBe(3)
      expect(messageWindow.has('10')).toBe(false)
      expect(messageWindow.has('20')).toBe(false)
      expect(messageWindow.has('30')).toBe(true)
      expect(messageWindow.has('40')).toBe(true)
      expect(messageWindow.has('50')).toBe(true)
    })

    it('should cleanup media blobs when removing messages', () => {
      const messagesWithMedia = [
        createMockMessage('10', true),
        createMockMessage('20', true),
        createMockMessage('30', true),
        createMockMessage('40', true),
        createMockMessage('50', true),
      ]

      messageWindow.addBatch(messagesWithMedia, 'newer')

      expect(mockedCleanupMediaBlobs).toHaveBeenCalledWith(messagesWithMedia[0].media)
    })

    it('should keep page metadata in sync when removing a single message', () => {
      messageWindow.addBatch([
        createMockMessage('10'),
        createMockMessage('20'),
      ], 'initial')
      messageWindow.addBatch([
        createMockMessage('30'),
      ], 'newer')

      messageWindow.remove('20')

      expect(messageWindow.pages).toEqual([
        ['10'],
        ['30'],
      ])
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
      messageWindow.addBatch([
        createMockMessage('10'),
        createMockMessage('20'),
      ], 'older')
      messageWindow.addBatch([
        createMockMessage('30'),
        createMockMessage('40'),
        createMockMessage('50'),
      ], 'newer')

      expect(messageWindow.minId).toBe(30)
      expect(messageWindow.maxId).toBe(50)
    })
  })
})
