import type { ITelegramClientAdapter } from '../../types'
import type { MultiSyncOptions, SyncTask, SyncType } from '../../types/sync'

import { useLogger } from '@tg-search/common'
import { cancelSyncConfig, getChatMetadataById, getSyncConfigByChatId, getSyncConfigByChatIdAndType } from '@tg-search/db'

import { SyncScheduler } from './scheduler'

export class MultiSyncService {
  private metadataScheduler: SyncScheduler
  private messageScheduler: SyncScheduler
  private logger = useLogger()

  constructor(
    private client: ITelegramClientAdapter,
    metadataConcurrent = 5, // metadata 同步支持更高并发
    messageConcurrent = 3, // messages 同步需要控制并发
  ) {
    this.metadataScheduler = new SyncScheduler(metadataConcurrent)
    this.messageScheduler = new SyncScheduler(messageConcurrent)
  }

  async startMultiSync(options: MultiSyncOptions): Promise<void> {
    const {
      chatIds,
      type = 'messages', // 默认为消息同步
      priorities = {},
      options: chatOptions = {},
    } = options

    // 如果是消息同步，先确保元数据是最新的
    if (type === 'messages') {
      await this.syncMetadata(chatIds)
    }

    // 验证所有会话是否存在
    const chats = await Promise.all(
      chatIds.map(id => getChatMetadataById(id)),
    )

    const missingChats = chatIds.filter(
      (id, index) => !chats[index],
    )

    if (missingChats.length > 0) {
      throw new Error(`Chats not found: ${missingChats.join(', ')}`)
    }

    // 创建同步任务
    const tasks: SyncTask[] = chatIds.map(chatId => ({
      type,
      chatId,
      priority: priorities[chatId] || 0,
      options: chatOptions[chatId] || {},
    }))

    // 按优先级排序并提交任务
    tasks.sort((a, b) => b.priority - a.priority)

    const scheduler = type === 'metadata'
      ? this.metadataScheduler
      : this.messageScheduler

    for (const task of tasks) {
      await scheduler.schedule(task)
    }
  }

  // 元数据同步总是全量进行
  async syncMetadata(chatIds: number[], options?: Partial<MultiSyncOptions>) {
    return this.startMultiSync({
      chatIds,
      type: 'metadata',
      ...options,
    })
  }

  // 消息同步支持更多选项
  async syncMessages(chatIds: number[], options?: Partial<MultiSyncOptions>) {
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
}
