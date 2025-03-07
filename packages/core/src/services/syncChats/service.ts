import type { DatabaseNewChat } from '@tg-search/db'
import type { ITelegramClientAdapter } from '../../types'
import type { ChatSyncStatus, ExtendedSyncTask, SyncProgressMetadata, SyncTask, SyncType, TaskMetadata } from '../../types/sync'

import { useLogger } from '@tg-search/common'
import { cancelSyncConfig, getSyncConfigByChatId, getSyncConfigByChatIdAndType } from '@tg-search/db'

import { SyncScheduler } from './scheduler'

export interface ChatsSyncOptions {
  chatIds: number[] // 要同步的会话 ID 列表
  type?: SyncType // 同步类型，默认为 'messages'
  priorities?: Record<number, number> // 会话 ID 到优先级的映射
  options?: Record<number, Record<string, any>> // 会话 ID 到同步选项的映射
  onProgress?: (progress: number, message: string, metadata: SyncProgressMetadata) => void
}

export class ChatsSyncServices {
  private metadataScheduler: SyncScheduler
  private messageScheduler: SyncScheduler
  private logger = useLogger()
  private dialogsCache: DatabaseNewChat[] | null = null
  private chatStatuses: Map<number, ChatSyncStatus> = new Map()

  constructor(
    private client: ITelegramClientAdapter,
    metadataConcurrent = 5, // metadata 同步支持更高并发
    messageConcurrent = 3, // messages 同步需要控制并发
  ) {
    this.metadataScheduler = new SyncScheduler(client, metadataConcurrent)
    this.messageScheduler = new SyncScheduler(client, messageConcurrent)
  }

  private initializeChatStatuses(chatIds: number[]) {
    chatIds.forEach((chatId) => {
      this.chatStatuses.set(chatId, {
        chatId,
        status: 'pending',
        progress: 0,
      })
    })
  }

  private updateChatStatus(chatId: number, update: Partial<ChatSyncStatus>) {
    const currentStatus = this.chatStatuses.get(chatId) || {
      chatId,
      status: 'pending',
      progress: 0,
    }
    this.chatStatuses.set(chatId, { ...currentStatus, ...update })
  }

  async startMultiSync(options: ChatsSyncOptions): Promise<void> {
    const {
      chatIds,
      type = 'messages',
      priorities = {},
      options: chatOptions = {},
      onProgress,
    } = options

    // Initialize chat statuses
    this.initializeChatStatuses(chatIds)

    // Create sync tasks
    const initialMetadata: SyncProgressMetadata = {
      chatId: chatIds[0], // Use first chat ID as current
      totalTasks: chatIds.length,
      completedTasks: 0,
      taskProgress: 0,
      chatStatuses: Array.from(this.chatStatuses.values()),
      type,
    }
    onProgress?.(5, '创建同步任务...', initialMetadata)

    const tasks: SyncTask[] = chatIds.map((chatId) => {
      const taskOptions = chatOptions[chatId] || {}
      return {
        type,
        chatId,
        priority: priorities[chatId] || 0,
        options: {
          incremental: taskOptions.incremental,
          skipMedia: taskOptions.skipMedia,
          fromMessageId: taskOptions.fromMessageId,
          toMessageId: taskOptions.toMessageId,
        },
      }
    })

    // Sort by priority
    tasks.sort((a, b) => b.priority - a.priority)

    // Select appropriate scheduler
    const scheduler = type === 'metadata'
      ? this.metadataScheduler
      : this.messageScheduler

    // Submit tasks and track progress
    let completedTasks = 0
    const totalTasks = tasks.length

    for (const task of tasks) {
      // Update current chat status to running
      this.updateChatStatus(task.chatId, { status: 'running' })

      try {
        // Create progress callback for this task
        const taskProgressCallback = (progress: number, metadata: TaskMetadata = {}) => {
          this.updateChatStatus(task.chatId, {
            progress,
            totalMessages: metadata.totalMessages,
            processedMessages: metadata.processedMessages,
            failedMessages: metadata.failedMessages,
          })

          // Calculate overall progress: 5% for init + 95% for tasks
          const taskProgress = (completedTasks / totalTasks) * 95
          const overallProgress = Math.floor(5 + taskProgress)

          const currentProgress = Math.floor((completedTasks / totalTasks) * 100)
          const progressMetadata: SyncProgressMetadata = {
            chatId: task.chatId,
            totalTasks,
            completedTasks,
            taskProgress: currentProgress,
            chatStatuses: Array.from(this.chatStatuses.values()),
            type,
            totalMessages: metadata.totalMessages,
            processedMessages: metadata.processedMessages,
            failedMessages: metadata.failedMessages,
          }

          onProgress?.(overallProgress, `同步进度: ${completedTasks}/${totalTasks}`, progressMetadata)
        }

        // Store the callback in the task
        const extendedTask: ExtendedSyncTask = {
          ...task,
          onProgress: taskProgressCallback,
        }

        // Execute the task
        await scheduler.schedule(extendedTask)

        // Update chat status to completed
        this.updateChatStatus(task.chatId, { status: 'completed', progress: 100 })
      }
      catch (error) {
        // Update chat status to failed
        this.updateChatStatus(task.chatId, {
          status: 'failed',
          error: error as Error,
        })
        this.logger.withError(error).error(`Failed to sync chat ${task.chatId}`)
      }

      completedTasks++
    }

    const finalMetadata: SyncProgressMetadata = {
      chatId: chatIds[chatIds.length - 1], // Use last chat ID
      totalTasks,
      completedTasks: totalTasks,
      taskProgress: 100,
      chatStatuses: Array.from(this.chatStatuses.values()),
      type,
    }
    onProgress?.(100, '同步完成', finalMetadata)
  }

  // 元数据同步总是全量进行
  async syncMetadata(chatIds: number[], options?: Partial<ChatsSyncOptions>) {
    return this.startMultiSync({
      chatIds,
      type: 'metadata',
      ...options,
    })
  }

  // 消息同步支持更多选项
  async syncMessages(chatIds: number[], options?: Partial<ChatsSyncOptions>) {
    return this.startMultiSync({
      chatIds,
      type: 'messages',
      ...options,
    })
  }

  async cancelSync(chatId: number, type?: SyncType): Promise<void> {
    await cancelSyncConfig(chatId, type)
  }

  async getSyncStatus(chatId: number, type?: SyncType) {
    return type
      ? getSyncConfigByChatIdAndType(chatId, type)
      : getSyncConfigByChatId(chatId)
  }

  // Get all chat statuses
  getChatStatuses() {
    return Array.from(this.chatStatuses.values())
  }
}
