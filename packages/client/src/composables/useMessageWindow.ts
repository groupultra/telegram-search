import type { CoreMessage } from '@tg-search/core'

import { cleanupMediaBlobs } from '../utils/blob'

export class MessageWindow {
  messages: Map<string, CoreMessage> = new Map()
  minId: number = Infinity
  maxId: number = -Infinity
  lastAccessTime: number = Date.now()

  private readonly maxSize: number

  constructor(maxSize: number = 50) {
    this.maxSize = maxSize
  }

  // Add multiple messages
  addBatch(messages: CoreMessage[]): void {
    messages.forEach((msg) => {
      const msgId = msg.platformMessageId

      this.messages.set(msgId, msg)

      this.minId = Math.min(Number(msgId), this.minId)
      this.maxId = Math.max(Number(msgId), this.maxId)
    })

    this.lastAccessTime = Date.now()
    this.cleanup()
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
    return Array.from(this.messages.keys())
      .sort((a, b) => Number(a) - Number(b))
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

  // Simple cleanup: keep only the latest messages when exceeding maxSize
  private cleanup(): void {
    if (this.messages.size <= this.maxSize) {
      return
    }

    // Get sorted message IDs (oldest first)
    const sortedIds = this.getSortedIds()

    // Calculate how many to remove
    const toRemove = this.messages.size - this.maxSize

    // Remove oldest messages and clean up their blobs
    const removedIds: string[] = []
    for (let i = 0; i < toRemove; i++) {
      const oldestId = sortedIds[i]
      if (oldestId) {
        this.cleanupMessage(oldestId)
        removedIds.push(oldestId)
      }
    }

    // Update minId and maxId after cleanup
    if (this.messages.size > 0) {
      // The new minimum ID is the first one that wasn't removed.
      // We can get it from the `sortedIds` array without re-sorting.
      this.minId = toRemove < sortedIds.length ? Number(sortedIds[toRemove]) : Infinity
    }
    else {
      // If all messages were removed, reset min/max to initial state.
      this.minId = Infinity
      this.maxId = -Infinity
    }

    console.warn(`[MessageWindow] Cleaned up ${toRemove} messages (${removedIds.join(', ')}), ${this.messages.size} remaining`)
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

    console.warn('[MessageWindow] All messages and blob URLs cleared')
  }
}
