import type { CoreMessage } from '@tg-search/core'

import { cleanupMediaBlobs } from '../utils/blob'

export class MessageWindow {
  messages: Map<string, CoreMessage> = new Map()
  minId: number = Infinity
  maxId: number = -Infinity
  lastAccessTime: number = Date.now()

  readonly maxSize: number

  constructor(maxSize: number = 50) {
    this.maxSize = maxSize
  }

  // Add multiple messages
  addBatch(messages: CoreMessage[], direction: 'older' | 'newer' | 'initial' = 'initial'): void {
    if (messages.length === 0)
      return

    const sortedNewMessages = messages.sort((a, b) => Number(a.platformMessageId) - Number(b.platformMessageId))

    sortedNewMessages.forEach((msg) => {
      const msgId = msg.platformMessageId

      this.messages.set(msgId, msg)

      this.minId = Math.min(Number(msgId), this.minId)
      this.maxId = Math.max(Number(msgId), this.maxId)
    })

    // eslint-disable-next-line no-console
    console.log('[MessageWindow] Add batch', messages.length, `${sortedNewMessages[0].platformMessageId} - ${sortedNewMessages[sortedNewMessages.length - 1].platformMessageId}`, `direction: ${direction}`)

    this.lastAccessTime = Date.now()

    // Trigger cleanup based on direction
    this.cleanupByDirection(direction)
  }

  // Get a message
  get(msgId: string): CoreMessage | undefined {
    this.lastAccessTime = Date.now()
    return this.messages.get(msgId)
  }

  // Check if message exists
  has(msgId: string): boolean {
    return this.messages.has(msgId)
  }

  // Get all message IDs sorted
  getSortedIds(): string[] {
    return Array.from(this.messages.keys()).sort((a, b) => Number(a) - Number(b))
  }

  // Get current size
  size(): number {
    return this.messages.size
  }

  // Clean up a single message and its blob URLs
  private cleanupMessage(msgId: string): void {
    const message = this.messages.get(msgId)
    if (message?.media) {
      // Clean up blob URLs to prevent memory leaks
      cleanupMediaBlobs(message.media)
    }
    this.messages.delete(msgId)
  }

  // Direction-based cleanup: when loading older messages, keep newer ones; when loading newer, keep older ones
  private cleanupByDirection(direction: 'older' | 'newer' | 'initial'): void {
    if (this.messages.size <= this.maxSize) {
      return
    }

    const sortedIds = this.getSortedIds()
    const excessCount = this.messages.size - this.maxSize
    const removedIds: string[] = []

    if (direction === 'older') {
      // When loading older messages, remove the newest (highest ID) messages
      const idsToRemove = sortedIds.slice(-excessCount)
      idsToRemove.forEach((id) => {
        this.cleanupMessage(id)
        removedIds.push(id)
      })
    }
    else if (direction === 'newer') {
      // When loading newer messages, remove the oldest (lowest ID) messages
      const idsToRemove = sortedIds.slice(0, excessCount)
      idsToRemove.forEach((id) => {
        this.cleanupMessage(id)
        removedIds.push(id)
      })
    }
    else {
      // For initial load, keep the most recent messages (default behavior)
      const idsToRemove = sortedIds.slice(0, excessCount)
      idsToRemove.forEach((id) => {
        this.cleanupMessage(id)
        removedIds.push(id)
      })
    }

    // Update minId and maxId
    if (this.messages.size > 0) {
      // TODO: performance issue?
      const remainingIds = this.getSortedIds()
      this.minId = Number(remainingIds[0])
      this.maxId = Number(remainingIds[remainingIds.length - 1])
    }
    else {
      this.minId = Infinity
      this.maxId = -Infinity
    }

    if (removedIds.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`[MessageWindow] Cleaned up ${removedIds.length} messages (${direction}), removed: ${removedIds[0]} - ${removedIds[removedIds.length - 1]}`)
    }
  }

  // Clear all messages and their blob URLs
  clear(): void {
    // Clean up all blob URLs before clearing
    this.messages.forEach((message) => {
      if (message.media) {
        cleanupMediaBlobs(message.media)
      }
    })

    this.messages.clear()
    this.minId = Infinity
    this.maxId = -Infinity
    this.lastAccessTime = Date.now()

    // eslint-disable-next-line no-console
    console.log('[MessageWindow] All messages and blob URLs cleared')
  }
}
