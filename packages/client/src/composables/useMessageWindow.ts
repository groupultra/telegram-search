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
  addBatch(messages: CoreMessage[], direction: 'older' | 'newer' | 'initial' = 'initial'): void {
    if (messages.length === 0)
      return

    const sortedNewMessages = messages.sort((a, b) => Number(a.platformMessageId) - Number(b.platformMessageId))

    messages.forEach((msg) => {
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
    return Array.from(this.messages.keys())
      .sort((a, b) => Number(a) - Number(b))
  }

  // Get current size
  size(): number {
    return this.messages.size
  }

  // Get center message ID (approximately middle of the window)
  getCenterMessageId(): string | undefined {
    const sortedIds = this.getSortedIds()
    if (sortedIds.length === 0)
      return undefined

    const centerIndex = Math.floor(sortedIds.length / 2)
    return sortedIds[centerIndex]
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

    // 更新minId和maxId
    if (this.messages.size > 0) {
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

  // 传递一个中心点 messageId 和保留范围 (kept for backward compatibility)
  cleanup(currentViewMessageId?: string, keepCount?: number): void {
    const effectiveKeepCount = keepCount ?? this.maxSize
    if (this.messages.size <= effectiveKeepCount) {
      return
    }

    const sortedIds = this.getSortedIds()
    let idsToKeep: Set<string>

    if (currentViewMessageId && this.messages.has(currentViewMessageId)) {
      // 找到当前查看消息的索引
      const currentIndex = sortedIds.indexOf(currentViewMessageId)

      // 计算要保留的消息范围（前后各保留一半）
      const halfKeep = Math.floor(effectiveKeepCount / 2)
      const startIdx = Math.max(0, currentIndex - halfKeep)
      const endIdx = Math.min(sortedIds.length - 1, currentIndex + halfKeep)

      // 获取要保留的消息ID
      idsToKeep = new Set(sortedIds.slice(startIdx, endIdx + 1))
    }
    else {
      // 如果没有指定中心消息，默认保留最近的消息
      idsToKeep = new Set(sortedIds.slice(-effectiveKeepCount))
    }

    // 删除不在保留范围内的消息
    const removedIds: string[] = []
    for (const id of sortedIds) {
      if (!idsToKeep.has(id)) {
        this.cleanupMessage(id)
        removedIds.push(id)
      }
    }

    // 更新minId和maxId
    if (this.messages.size > 0) {
      // 计算新的minId和maxId
      const remainingIds = this.getSortedIds()
      this.minId = Number(remainingIds[0])
      this.maxId = Number(remainingIds[remainingIds.length - 1])
    }
    else {
      // If all messages were removed, reset min/max to initial state.
      this.minId = Infinity
      this.maxId = -Infinity
    }

    if (removedIds.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`[MessageWindow] Cleaned up ${removedIds.length} messages, ${removedIds[0]} - ${removedIds[removedIds.length - 1]}`)
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
