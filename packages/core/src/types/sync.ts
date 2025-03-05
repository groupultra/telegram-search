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

export interface MultiSyncOptions {
  chatIds: number[] // 要同步的会话 ID 列表
  type?: SyncType // 同步类型，默认为 'messages'
  priorities?: Record<number, number> // 会话 ID 到优先级的映射
  options?: Record<number, Record<string, any>> // 会话 ID 到同步选项的映射
}
