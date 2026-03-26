import type { CoreMessage } from '@tg-search/core'

import { useLogger } from '@guiiai/logg'

import { cleanupMediaBlobs } from '../utils/blob'

type MessageBatchDirection = 'older' | 'newer' | 'initial'

export class MessageWindow {
  messages: Map<string, CoreMessage> = new Map()
  pages: string[][] = []
  minId: number = Infinity
  maxId: number = -Infinity
  lastAccessTime: number = Date.now()
  logger = useLogger('MessageWindow')

  readonly maxSize: number
  readonly trimThreshold: number

  constructor(maxSize: number = 50) {
    this.maxSize = maxSize
    this.trimThreshold = maxSize + Math.max(1, Math.ceil(maxSize * 0.1))
  }

  // Add multiple messages
  addBatch(messages: CoreMessage[], direction: MessageBatchDirection = 'initial'): void {
    if (messages.length === 0)
      return

    const sortedNewMessages = [...messages].sort((a, b) => Number(a.platformMessageId) - Number(b.platformMessageId))
    const introducedIds: string[] = []

    sortedNewMessages.forEach((msg) => {
      const msgId = msg.platformMessageId

      if (!this.messages.has(msgId)) {
        introducedIds.push(msgId)
      }

      this.messages.set(msgId, msg)

      this.minId = Math.min(Number(msgId), this.minId)
      this.maxId = Math.max(Number(msgId), this.maxId)
    })

    this.recordPage(introducedIds, direction)

    this.logger.debug('Add batch', messages.length, `${sortedNewMessages[0].platformMessageId} - ${sortedNewMessages[sortedNewMessages.length - 1].platformMessageId}`, `direction: ${direction}`)

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

  remove(msgId: string): void {
    this.cleanupMessage(msgId)
    this.recalcBounds()
  }

  // Get all message IDs sorted
  getSortedIds(): string[] {
    return Array.from(this.messages.keys()).sort((a, b) => Number(a) - Number(b))
  }

  // Get current size
  size(): number {
    return this.messages.size
  }

  // Recalculate minId/maxId from remaining page boundaries.
  // Pages are ordered oldest-first, so the first ID of the first page
  // and the last ID of the last page give us the bounds in O(pages).
  private recalcBounds(): void {
    if (this.messages.size === 0) {
      this.minId = Infinity
      this.maxId = -Infinity
      return
    }

    let min = Infinity
    let max = -Infinity
    for (const page of this.pages) {
      for (const id of page) {
        const num = Number(id)
        if (num < min)
          min = num
        if (num > max)
          max = num
      }
    }
    this.minId = min
    this.maxId = max
  }

  // Clean up a single message and its blob URLs
  private cleanupMessage(msgId: string): void {
    const message = this.messages.get(msgId)
    if (message?.media) {
      // Clean up blob URLs to prevent memory leaks
      cleanupMediaBlobs(message.media)
    }
    this.messages.delete(msgId)
    this.removeMessageFromPages(msgId)
  }

  private recordPage(messageIds: string[], direction: MessageBatchDirection): void {
    if (messageIds.length === 0) {
      return
    }

    if (direction === 'older') {
      this.pages.unshift(messageIds)
      return
    }

    if (direction === 'initial' && this.pages.length === 0) {
      this.pages = [messageIds]
      return
    }

    this.pages.push(messageIds)
  }

  private removeMessageFromPages(msgId: string): void {
    this.pages = this.pages
      .map(page => page.filter(id => id !== msgId))
      .filter(page => page.length > 0)
  }

  // Direction-based cleanup: trim the opposite edge by whole fetched pages so
  // prepending history does not immediately tear apart the current viewport.
  private cleanupByDirection(direction: MessageBatchDirection): void {
    if (this.messages.size <= this.trimThreshold) {
      return
    }

    const removedIds: string[] = []

    while (this.messages.size > this.trimThreshold && this.pages.length > 0) {
      const pageToRemove = direction === 'older'
        ? this.pages[this.pages.length - 1]
        : this.pages[0]

      if (!pageToRemove || pageToRemove.length === 0) {
        if (direction === 'older') {
          this.pages.pop()
        }
        else {
          this.pages.shift()
        }
        continue
      }

      for (const id of [...pageToRemove]) {
        if (!this.messages.has(id)) {
          this.removeMessageFromPages(id)
          continue
        }

        this.cleanupMessage(id)
        removedIds.push(id)
      }
    }

    this.recalcBounds()

    if (removedIds.length > 0) {
      this.logger.debug(`Cleaned up ${removedIds.length} messages (${direction}), removed: ${removedIds[0]} - ${removedIds[removedIds.length - 1]}`)
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
    this.pages = []
    this.minId = Infinity
    this.maxId = -Infinity
    this.lastAccessTime = Date.now()

    this.logger.debug('All messages and blob URLs cleared')
  }
}
