import type { SyncConfigItem } from '@tg-search/db'
import type { SyncTask, SyncType } from '../../types'

import { useLogger } from '@tg-search/common'
import { cancelSyncConfig, getSyncConfigByChatId, getSyncConfigByChatIdAndType, updateSyncStatus, upsertSyncConfig } from '@tg-search/db'

import { PriorityQueue } from './priority-queue'

export class SyncScheduler {
  private maxConcurrent: number
  private queue: PriorityQueue<SyncTask>
  private active = new Set<number>()
  private logger = useLogger()

  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent
    this.queue = new PriorityQueue((a, b) => b.priority - a.priority)
  }

  async schedule(task: SyncTask): Promise<void> {
    // 检查是否已在队列或活动中
    if (this.active.has(task.chatId) || this.queue.contains(t => t.chatId === task.chatId)) {
      this.logger.warn(`Chat ${task.chatId} is already being synced`)
      return
    }

    // 更新数据库状态
    await upsertSyncConfig(task.chatId, {
      syncType: task.type,
      status: 'queued',
      priority: task.priority,
      options: task.options || {},
    })

    if (this.active.size >= this.maxConcurrent) {
      this.queue.push(task)
      return
    }

    await this.startSync(task)
  }

  private async startSync(task: SyncTask): Promise<void> {
    this.active.add(task.chatId)

    try {
      await updateSyncStatus(task.chatId, { status: 'running' })

      // 执行同步
      await this.executeSync(task)

      await updateSyncStatus(task.chatId, {
        status: 'completed',
        lastSyncTime: new Date(),
      })
    }
    catch (error) {
      this.logger.withError(error).error(`Failed to sync chat ${task.chatId}`)
      await updateSyncStatus(task.chatId, {
        status: 'failed',
        lastError: error instanceof Error ? error.message : String(error),
      })
    }
    finally {
      this.active.delete(task.chatId)
      this.processQueue()
    }
  }

  private async processQueue(): Promise<void> {
    if (this.active.size >= this.maxConcurrent || this.queue.isEmpty()) {
      return
    }

    const task = this.queue.pop()
    if (task) {
      await this.startSync(task)
    }
  }

  private async executeSync(_task: SyncTask): Promise<void> {
    // 实际的同步逻辑将在 SyncService 中实现
    // 这里只是一个占位符
    throw new Error('Not implemented')
  }

  async cancelSync(chatId: number, type?: SyncType): Promise<void> {
    // 从队列中移除
    if (this.queue.contains(t => t.chatId === chatId && (!type || t.type === type))) {
      // 由于 PriorityQueue 不支持直接移除，我们需要重建队列
      const remainingTasks = []
      while (!this.queue.isEmpty()) {
        const task = this.queue.pop()!
        if (task.chatId !== chatId || (type && task.type !== type)) {
          remainingTasks.push(task)
        }
      }
      remainingTasks.forEach(task => this.queue.push(task))
    }

    // 更新数据库状态
    await cancelSyncConfig(chatId, type)
  }

  async getSyncStatus(chatId: number, type?: SyncType): Promise<SyncConfigItem | null> {
    return type
      ? getSyncConfigByChatIdAndType(chatId, type)
      : getSyncConfigByChatId(chatId)
  }
}
