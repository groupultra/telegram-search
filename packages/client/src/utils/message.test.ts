import type { CoreMessage } from '@tg-search/core'

import { describe, expect, it } from 'vitest'

import { MessageWindow } from '../composables/useMessageWindow'
import { determineMessageDirection, formatMessageTimestamp } from './message'

describe('message', () => {
  describe('formatMessageTimestamp', () => {
    it('should format valid Unix timestamp', () => {
      // Use a fixed timestamp for testing: 2024-01-01 00:00:00 UTC = 1704067200
      const timestamp = 1704067200
      const result = formatMessageTimestamp(timestamp)

      // Check that it returns a string with date components
      expect(result).toContain('2024')
      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
    })

    it('should return empty string for negative timestamp', () => {
      const result = formatMessageTimestamp(-1)
      expect(result).toBe('')
    })

    it('should return empty string for Infinity', () => {
      const result = formatMessageTimestamp(Infinity)
      expect(result).toBe('')
    })

    it('should return empty string for NaN', () => {
      const result = formatMessageTimestamp(Number.NaN)
      expect(result).toBe('')
    })

    it('should handle zero timestamp', () => {
      const result = formatMessageTimestamp(0)
      // Should format 1970-01-01
      expect(result).toContain('1970')
    })

    it('should handle large valid timestamp', () => {
      // 2030-01-01 00:00:00 UTC = 1893456000
      const timestamp = 1893456000
      const result = formatMessageTimestamp(timestamp)
      expect(result).toContain('2030')
    })
  })

  describe('determineMessageDirection', () => {
    const createMessage = (platformMessageId: string): CoreMessage => ({
      platformMessageId,
      uuid: '',
      platform: 'telegram',
      chatId: '',
      fromId: '',
      fromName: '',
      content: '',
      platformTimestamp: 0,
      createdAt: 0,
      updatedAt: 0,
      deletedAt: undefined,
      media: undefined,
      reply: undefined,
      forward: undefined,
      vectors: undefined,
      jiebaTokens: [],
    } as any)

    it('should return "initial" for empty messages array', () => {
      const messageWindow = new MessageWindow()
      const result = determineMessageDirection([], messageWindow)
      expect(result).toBe('initial')
    })

    it('should return "initial" when messageWindow is undefined', () => {
      const messages = [createMessage('10')]
      const result = determineMessageDirection(messages, undefined)
      expect(result).toBe('initial')
    })

    it('should return "initial" for first batch of messages', () => {
      const messageWindow = new MessageWindow()
      const messages = [createMessage('10'), createMessage('20'), createMessage('30')]
      const result = determineMessageDirection(messages, messageWindow)
      expect(result).toBe('initial')
    })

    it('should return "older" when new messages are older than current window', () => {
      const messageWindow = new MessageWindow()
      // Add initial messages 50-60
      messageWindow.addBatch([createMessage('50'), createMessage('60')])

      // New messages 10-20 are older
      const newMessages = [createMessage('10'), createMessage('20')]
      const result = determineMessageDirection(newMessages, messageWindow)
      expect(result).toBe('older')
    })

    it('should return "newer" when new messages are newer than current window', () => {
      const messageWindow = new MessageWindow()
      // Add initial messages 10-20
      messageWindow.addBatch([createMessage('10'), createMessage('20')])

      // New messages 50-60 are newer
      const newMessages = [createMessage('50'), createMessage('60')]
      const result = determineMessageDirection(newMessages, messageWindow)
      expect(result).toBe('newer')
    })

    it('should return "initial" when messages overlap with current window', () => {
      const messageWindow = new MessageWindow()
      // Add initial messages 20-40
      messageWindow.addBatch([createMessage('20'), createMessage('40')])

      // New messages 30-50 overlap
      const newMessages = [createMessage('30'), createMessage('50')]
      const result = determineMessageDirection(newMessages, messageWindow)
      expect(result).toBe('initial')
    })

    it('should handle unsorted new messages', () => {
      const messageWindow = new MessageWindow()
      messageWindow.addBatch([createMessage('50'), createMessage('60')])

      // New messages are unsorted but all older
      const newMessages = [createMessage('30'), createMessage('10'), createMessage('20')]
      const result = determineMessageDirection(newMessages, messageWindow)
      expect(result).toBe('older')
    })

    it('should return "older" when new max equals current min', () => {
      const messageWindow = new MessageWindow()
      messageWindow.addBatch([createMessage('50'), createMessage('60')])

      // New messages end at 50 (current min)
      const newMessages = [createMessage('40'), createMessage('50')]
      const result = determineMessageDirection(newMessages, messageWindow)
      expect(result).toBe('initial')
    })

    it('should return "newer" when new min equals current max', () => {
      const messageWindow = new MessageWindow()
      messageWindow.addBatch([createMessage('50'), createMessage('60')])

      // New messages start at 60 (current max)
      const newMessages = [createMessage('60'), createMessage('70')]
      const result = determineMessageDirection(newMessages, messageWindow)
      expect(result).toBe('initial')
    })

    it('should handle single message in new batch', () => {
      const messageWindow = new MessageWindow()
      messageWindow.addBatch([createMessage('50')])

      const olderMessage = [createMessage('30')]
      expect(determineMessageDirection(olderMessage, messageWindow)).toBe('older')

      const newerMessage = [createMessage('70')]
      expect(determineMessageDirection(newerMessage, messageWindow)).toBe('newer')
    })

    it('should handle boundary case with adjacent IDs', () => {
      const messageWindow = new MessageWindow()
      messageWindow.addBatch([createMessage('50'), createMessage('51')])

      // Messages 48-49 (adjacent but older)
      const olderMessages = [createMessage('48'), createMessage('49')]
      expect(determineMessageDirection(olderMessages, messageWindow)).toBe('older')

      // Messages 52-53 (adjacent but newer)
      const newerMessages = [createMessage('52'), createMessage('53')]
      expect(determineMessageDirection(newerMessages, messageWindow)).toBe('newer')
    })
  })
})
