# 多会话同步支持方案

## 1. 概述

多会话同步支持允许用户同时同步多个 Telegram 会话。系统中存在两种不同类型的同步：

1. **Metadata 同步**

   - 同步会话的元数据（标题、类型、头像等基本信息）
   - 默认进行全量同步，确保数据一致性
   - 资源消耗较低，可以支持更高的并发
   - 通常作为消息同步的前置步骤

2. **Messages 同步**
   - 同步会话中的具体消息内容
   - 支持增量同步和选择性同步
   - 资源消耗较高，需要严格控制并发
   - 可以根据用户需求配置同步选项

系统通过优先级队列和资源管理来确保同步过程的稳定性。

## 2. 实现步骤

### 2.1 数据模型扩展

1. 修改数据库 Schema (`packages/db/src/schema.ts`):

```typescript
import { bigint, index, integer, jsonb, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core'

export const syncConfigItems = pgTable('sync_config_items', {
  id: serial('id').primaryKey(),
  chatId: bigint('chat_id', { mode: 'number' }).notNull(),
  syncType: varchar('sync_type', { length: 20 }).notNull(), // 'metadata' 或 'messages'
  status: varchar('status', { length: 20 }).notNull().default('idle'),
  priority: integer('priority').default(0),
  lastSyncTime: timestamp('last_sync_time'),
  lastMessageId: bigint('last_message_id', { mode: 'number' }),
  metadataVersion: integer('metadata_version'), // 用于追踪元数据版本
  lastError: text('last_error'),
  options: jsonb('options').default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, table => ({
  chatTypeIdx: index('idx_sync_items_chat_type').on(table.chatId, table.syncType),
  statusIdx: index('idx_sync_config_items_status').on(table.status),
  priorityIdx: index('idx_sync_config_items_priority').on(table.priority),
}))

// 生成类型
export type SyncConfigItem = typeof syncConfigItems.$inferSelect
export type NewSyncConfigItem = typeof syncConfigItems.$inferInsert
```

2. 生成迁移文件：

```bash
# 生成迁移文件
pnpm db:generate

# 执行迁移
pnpm db:migrate
```

### 2.2 核心服务扩展

1. 定义同步任务类型 (`packages/core/src/types/sync.ts`):

```typescript
export type SyncType = 'metadata' | 'messages'

export interface SyncTask {
  type: SyncType
  chatId: number
  priority: number
  options?: {
    // metadata 同步选项
    // metadata 默认进行全量同步，无需额外选项

    // messages 同步选项
    incremental?: boolean
    skipMedia?: boolean
    fromMessageId?: number
    toMessageId?: number
  }
}

export interface MultiSyncOptions {
  chatIds: number[]
  type?: SyncType
  priorities?: Record<number, number>
  options?: Record<number, Record<string, any>>
}
```

2. 创建同步调度器 (`packages/core/src/services/sync/scheduler.ts`):

```typescript
import { useLogger } from '@tg-search/common'
import { db } from '@tg-search/db'

import { PriorityQueue } from './priority-queue'

export interface SyncTask {
  chatId: number
  priority: number
  options?: Record<string, any>
}

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
    await db.syncConfigItems.upsert({
      where: { chatId: task.chatId },
      create: {
        chatId: task.chatId,
        status: 'queued',
        priority: task.priority,
        options: task.options || {},
      },
      update: {
        status: 'queued',
        priority: task.priority,
        options: task.options || {},
      },
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
      await db.syncConfigItems.update({
        where: { chatId: task.chatId },
        data: { status: 'running' },
      })

      // 执行同步
      await this.executeSync(task)

      await db.syncConfigItems.update({
        where: { chatId: task.chatId },
        data: {
          status: 'completed',
          lastSyncTime: new Date(),
        },
      })
    }
    catch (error) {
      this.logger.error(`Failed to sync chat ${task.chatId}:`, error)
      await db.syncConfigItems.update({
        where: { chatId: task.chatId },
        data: {
          status: 'failed',
          lastError: error instanceof Error ? error.message : String(error),
        },
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

  private async executeSync(task: SyncTask): Promise<void> {
    // 实际的同步逻辑将在 SyncService 中实现
  }
}
```

3. 扩展同步服务 (`packages/core/src/services/sync/service.ts`):

```typescript
import type { ITelegramClientAdapter } from '../../types'
import type { MultiSyncOptions, SyncTask, SyncType } from '../../types/sync'

import { useLogger } from '@tg-search/common'
import { db } from '@tg-search/db'

import { SyncScheduler } from './scheduler'

export class MultiSyncService {
  private metadataScheduler: SyncScheduler
  private messageScheduler: SyncScheduler
  private logger = useLogger()

  constructor(
    private client: ITelegramClientAdapter,
    metadataConcurrent = 5, // metadata 同步支持更高并发
    messageConcurrent = 3 // messages 同步需要控制并发
  ) {
    this.metadataScheduler = new SyncScheduler(metadataConcurrent)
    this.messageScheduler = new SyncScheduler(messageConcurrent)
  }

  async startMultiSync(options: MultiSyncOptions): Promise<void> {
    const {
      chatIds,
      type = 'messages', // 默认为消息同步
      priorities = {},
      options: chatOptions = {}
    } = options

    // 如果是消息同步，先确保元数据是最新的
    if (type === 'messages') {
      await this.syncMetadata(chatIds)
    }

    // 验证所有会话是否存在
    const chats = await db.chats.findMany({
      where: { id: { in: chatIds } },
    })

    if (chats.length !== chatIds.length) {
      const missingChats = chatIds.filter(
        id => !chats.some(chat => chat.id === id)
      )
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
    const where = type
      ? { chatId, syncType: type }
      : { chatId }

    await db.syncConfigItems.update({
      where,
      data: { status: 'cancelled' },
    })
  }

  async getSyncStatus(chatId: number, type?: SyncType) {
    const where = type
      ? { chatId, syncType: type }
      : { chatId }

    return await db.syncConfigItems.findFirst({ where })
  }
}
```

### 2.3 API 路由扩展

1. 添加多会话同步路由 (`packages/server/src/routes/commands.ts`):

```typescript
import { MultiSyncService } from '@tg-search/core'
import { z } from 'zod'

// 验证模式
const multiSyncSchema = z.object({
  chatIds: z.array(z.number()),
  priorities: z.record(z.string(), z.number()).optional(),
  options: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
})

// 路由处理
router.post('/multi-sync', defineEventHandler(async (event: H3Event) => {
  const body = await readBody(event)
  const validatedBody = multiSyncSchema.parse(body)

  const client = await useTelegramClient()
  if (!await client.isConnected()) {
    await client.connect()
  }

  const service = new MultiSyncService(client)
  return createSSEResponse(async (controller) => {
    try {
      await service.startMultiSync(validatedBody)
      controller.send({ type: 'success' })
    }
    catch (error) {
      controller.send({
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
      })
    }
  })
}))
```

### 2.4 前端组件扩展

1. 添加多会话选择组件 (`packages/frontend/src/components/commands/MultiSyncSelector.vue`):

```vue
<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-medium">{{ t('sync_command.select_chats') }}</h3>
      <button
        class="rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
        @click="startSync"
        :disabled="selectedChats.length === 0"
      >
        {{ t('sync_command.start_sync') }}
      </button>
    </div>

    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="chat in chats"
        :key="chat.id"
        class="relative flex items-center space-x-3 rounded-lg border p-4"
        :class="{
          'border-blue-500 bg-blue-50': isSelected(chat.id),
          'border-gray-200': !isSelected(chat.id)
        }"
      >
        <div class="flex-1 min-w-0">
          <div class="focus:outline-none">
            <span class="absolute inset-0" aria-hidden="true" />
            <p class="text-sm font-medium text-gray-900">
              {{ chat.title }}
            </p>
            <p class="truncate text-sm text-gray-500">
              ID: {{ chat.id }}
            </p>
          </div>
        </div>
        <div class="flex-shrink-0">
          <input
            type="checkbox"
            :checked="isSelected(chat.id)"
            @change="toggleSelection(chat.id)"
            class="h-4 w-4 rounded border-gray-300 text-blue-600"
          >
        </div>
      </div>
    </div>

    <!-- Priority Settings Dialog -->
    <Dialog v-model="showPriorityDialog">
      <div class="space-y-4">
        <h3 class="text-lg font-medium">
          {{ t('sync_command.set_priorities') }}
        </h3>
        <div class="space-y-2">
          <div
            v-for="chatId in selectedChats"
            :key="chatId"
            class="flex items-center justify-between"
          >
            <span>{{ getChatTitle(chatId) }}</span>
            <input
              type="number"
              v-model="priorities[chatId]"
              min="0"
              max="100"
              class="w-20 rounded-md border-gray-300"
            >
          </div>
        </div>
        <div class="flex justify-end space-x-2">
          <button
            class="rounded-md bg-gray-500 px-4 py-2 text-white"
            @click="showPriorityDialog = false"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            class="rounded-md bg-blue-500 px-4 py-2 text-white"
            @click="confirmPriorities"
          >
            {{ t('common.confirm') }}
          </button>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Dialog } from '@headlessui/vue'
import { useChats } from '../../composables/useChats'
import { useSyncChats } from '../../composables/useSyncChats'

const { t } = useI18n()
const { chats } = useChats()
const { executeMultiSync } = useSyncChats()

const selectedChats = ref<number[]>([])
const priorities = ref<Record<number, number>>({})
const showPriorityDialog = ref(false)

const isSelected = (chatId: number) => selectedChats.value.includes(chatId)
const getChatTitle = (chatId: number) =>
  chats.value.find(c => c.id === chatId)?.title || chatId

const toggleSelection = (chatId: number) => {
  const index = selectedChats.value.indexOf(chatId)
  if (index === -1) {
    selectedChats.value.push(chatId)
    priorities.value[chatId] = 0
  } else {
    selectedChats.value.splice(index, 1)
    delete priorities.value[chatId]
  }
}

const startSync = async () => {
  if (selectedChats.value.length === 0) return

  showPriorityDialog.value = true
}

const confirmPriorities = async () => {
  showPriorityDialog.value = false

  try {
    await executeMultiSync({
      chatIds: selectedChats.value,
      priorities: priorities.value,
    })
  } catch (error) {
    console.error('Failed to start sync:', error)
  }
}
</script>
```

2. 添加多会话同步状态组件 (`packages/frontend/src/components/commands/MultiSyncStatus.vue`):

```vue
<template>
  <div class="space-y-4">
    <h3 class="text-lg font-medium">
      {{ t('sync_command.sync_status') }}
    </h3>

    <div class="space-y-2">
      <div
        v-for="status in syncStatus"
        :key="status.chatId"
        class="rounded-lg border p-4"
        :class="{
          'border-blue-500 bg-blue-50': status.status === 'running',
          'border-green-500 bg-green-50': status.status === 'completed',
          'border-red-500 bg-red-50': status.status === 'failed'
        }"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium">{{ getChatTitle(status.chatId) }}</p>
            <p class="text-sm text-gray-500">
              {{ t(`sync_command.status.${status.status}`) }}
            </p>
          </div>
          <button
            v-if="status.status === 'running'"
            class="text-red-600 hover:text-red-700"
            @click="cancelSync(status.chatId)"
          >
            {{ t('common.cancel') }}
          </button>
        </div>

        <div v-if="status.lastError" class="mt-2 text-sm text-red-600">
          {{ status.lastError }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useChats } from '../../composables/useChats'
import { useSyncChats } from '../../composables/useSyncChats'

const { t } = useI18n()
const { chats } = useChats()
const { getSyncStatus, cancelSync } = useSyncChats()

const syncStatus = ref<Array<{
  chatId: number
  status: string
  lastError?: string
}>>([])

const getChatTitle = (chatId: number) =>
  chats.value.find(c => c.id === chatId)?.title || chatId

let statusInterval: NodeJS.Timeout

const updateStatus = async () => {
  const activeChats = syncStatus.value
    .filter(s => s.status === 'running' || s.status === 'queued')
    .map(s => s.chatId)

  if (activeChats.length === 0) return

  for (const chatId of activeChats) {
    const status = await getSyncStatus(chatId)
    if (status) {
      const index = syncStatus.value.findIndex(s => s.chatId === chatId)
      if (index !== -1) {
        syncStatus.value[index] = status
      }
    }
  }
}

onMounted(() => {
  statusInterval = setInterval(updateStatus, 1000)
})

onUnmounted(() => {
  clearInterval(statusInterval)
})
</script>
```

## 3. 使用示例

```typescript
// 初始化多会话同步服务
const client = await useTelegramClient()
const syncService = new MultiSyncService(client)

// 1. 仅同步元数据（全量）
await syncService.syncMetadata([123, 456, 789])

// 2. 同步消息（会自动先同步元数据）
await syncService.syncMessages([123, 456, 789], {
  priorities: {
    123: 2, // 高优先级
    456: 1, // 中优先级
    789: 0, // 低优先级
  },
  options: {
    123: { incremental: true },
    456: { skipMedia: true },
  },
})

// 3. 获取特定类型的同步状态
const metadataStatus = await syncService.getSyncStatus(123, 'metadata')
const messagesStatus = await syncService.getSyncStatus(123, 'messages')

// 4. 取消特定类型的同步
await syncService.cancelSync(123, 'messages')
```

## 4. 注意事项

1. 数据库迁移

   - 执行迁移前备份数据库
   - 在测试环境验证迁移脚本
   - 准备回滚脚本

2. 性能优化

   - 监控队列长度和处理时间
   - 根据系统负载动态调整并发数
   - 定期清理过期的同步记录

3. 错误处理

   - 实现重试机制
   - 记录详细的错误信息
   - 提供手动恢复机制

4. 监控告警
   - 监控同步队列长度
   - 监控失败率
   - 设置适当的告警阈值
