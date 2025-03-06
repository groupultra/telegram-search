import type { SyncConfigItem } from '@tg-search/db'
import type { SyncTask, SyncType } from '../../types'
import type { ITelegramClientAdapter } from '../../types/adapter'

import { useLogger } from '@tg-search/common'
import { cancelSyncConfig, getSyncConfigByChatId, getSyncConfigByChatIdAndType, updateSyncStatus, upsertSyncConfig } from '@tg-search/db'

import { ExportService } from '../export'
import { PriorityQueue } from './priority-queue'

export class SyncScheduler {
  private maxConcurrent: number
  private queue: PriorityQueue<SyncTask>
  private active = new Set<number>()
  private logger = useLogger()
  private exportService: ExportService

  constructor(
    private client: ITelegramClientAdapter,
    maxConcurrent = 3,
  ) {
    this.maxConcurrent = maxConcurrent
    this.queue = new PriorityQueue((a, b) => b.priority - a.priority)
    this.exportService = new ExportService(client)
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

      // Execute sync based on task type
      if (task.type === 'metadata') {
        await this.executeMetadataSync(task)
      }
      else {
        await this.executeMessageSync(task)
      }

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

  private async executeMetadataSync(task: SyncTask): Promise<void> {
    const { chatId } = task

    // Get chat metadata first
    const chats = await this.client.getDialogs()
    const chat = chats.find(c => c.id === chatId)
    if (!chat) {
      throw new Error(`Chat ${chatId} not found`)
    }

    // Use export service with metadata-only configuration
    await this.exportService.exportMessages({
      chatId,
      chatMetadata: {
        id: chat.id,
        title: chat.title,
        type: chat.type,
      },
      messageTypes: [], // Empty array means no messages will be fetched
      limit: 1, // Minimal limit since we don't need messages
      format: 'database',
      method: 'getMessage',
      incremental: false,
      onProgress: (progress, message, metadata) => {
        this.logger.debug('Metadata sync progress', {
          progress,
          message,
          metadata,
          chatId,
        })
      },
    })
  }

  private async executeMessageSync(task: SyncTask): Promise<void> {
    const { chatId, options = {} } = task

    // Get chat metadata first
    const chats = await this.client.getDialogs()
    const chat = chats.find(c => c.id === chatId)
    if (!chat) {
      throw new Error(`Chat ${chatId} not found`)
    }

    // Use export service with message sync configuration
    await this.exportService.exportMessages({
      chatId,
      chatMetadata: {
        id: chat.id,
        title: chat.title,
        type: chat.type,
      },
      messageTypes: ['text'], // Default to text messages
      format: 'database',
      method: 'getMessage',
      incremental: options.incremental ?? true,
      minId: options.fromMessageId,
      maxId: options.toMessageId,
      onProgress: (progress, message, metadata) => {
        this.logger.debug('Message sync progress', {
          progress,
          message,
          metadata,
          chatId,
        })
      },
    })
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
