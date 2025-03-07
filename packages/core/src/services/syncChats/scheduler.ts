import type { SyncConfigItem } from '@tg-search/db'
import type { ExtendedSyncTask, SyncType, TaskMetadata } from '../../types'
import type { ITelegramClientAdapter } from '../../types/adapter'
import type { ExportOptions } from '../export'

import { useLogger } from '@tg-search/common'
import { cancelSyncConfig, getSyncConfigByChatId, getSyncConfigByChatIdAndType, updateSyncStatus, upsertSyncConfig } from '@tg-search/db'

import { ExportService } from '../export'
import { PriorityQueue } from './priority-queue'

export class SyncScheduler {
  private maxConcurrent: number
  private queue: PriorityQueue<ExtendedSyncTask>
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

  async schedule(task: ExtendedSyncTask): Promise<void> {
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

  private async startSync(task: ExtendedSyncTask): Promise<void> {
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

  private async executeMetadataSync(task: ExtendedSyncTask): Promise<void> {
    const { chatId } = task

    // Get chat metadata first
    const chats = await this.client.getDialogs()
    const chat = chats.find(c => c.id === chatId)
    if (!chat) {
      throw new Error(`Chat ${chatId} not found`)
    }

    // Use export service with metadata-only configuration
    const exportOptions: ExportOptions = {
      chatId,
      chatMetadata: {
        id: chat.id,
        title: chat.title,
        type: chat.type,
      },
      messageTypes: [], // Empty array means no messages will be fetched
      onProgress: (progress, message, metadata) => {
        const typedMetadata = typeof metadata === 'object' ? metadata as TaskMetadata : {}
        task.onProgress?.(progress, typedMetadata)
      },
    }

    await this.exportService.exportMessages(exportOptions)
  }

  private async executeMessageSync(task: ExtendedSyncTask): Promise<void> {
    const { chatId, options = {} } = task

    // Get chat metadata first
    const chats = await this.client.getDialogs()
    const chat = chats.find(c => c.id === chatId)
    if (!chat) {
      throw new Error(`Chat ${chatId} not found`)
    }

    // Use export service with message sync configuration
    const exportOptions: ExportOptions = {
      chatId,
      chatMetadata: {
        id: chat.id,
        title: chat.title,
        type: chat.type,
      },
      incremental: options.incremental,
      minId: options.fromMessageId,
      maxId: options.toMessageId,
      onProgress: (progress, message, metadata) => {
        const typedMetadata = typeof metadata === 'object' ? metadata as TaskMetadata : {}
        task.onProgress?.(progress, typedMetadata)
      },
    }

    await this.exportService.exportMessages(exportOptions)
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
    await cancelSyncConfig(chatId, type)
  }

  async getSyncStatus(chatId: number, type?: SyncType): Promise<SyncConfigItem | null> {
    return type
      ? getSyncConfigByChatIdAndType(chatId, type)
      : getSyncConfigByChatId(chatId)
  }
}
