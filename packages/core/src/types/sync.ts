export type SyncType = 'metadata' | 'messages'

export interface SyncTask {
  type: SyncType
  chatId: number
  priority: number
  options?: {
    // metadata 同步选项
    // metadata 默认进行全量同步，无需额外选项

    // messages 同步选项
    incremental?: boolean // 是否增量同步
    skipMedia?: boolean // 是否跳过媒体文件
    fromMessageId?: number // 起始消息 ID
    toMessageId?: number // 结束消息 ID
  }
}

export interface ChatSyncStatus {
  chatId: number
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  totalMessages?: number
  processedMessages?: number
  failedMessages?: number
  error?: Error | string
}

export interface SyncProgressMetadata {
  chatId: number
  totalTasks: number
  completedTasks: number
  taskProgress: number
  chatStatuses: ChatSyncStatus[]
  type: SyncType
  totalMessages?: number
  processedMessages?: number
  failedMessages?: number
}

export interface TaskMetadata {
  totalMessages?: number
  processedMessages?: number
  failedMessages?: number

  [key: string]: any
}

export interface ExtendedSyncTask extends SyncTask {
  onProgress?: (progress: number, metadata?: TaskMetadata) => void
}
