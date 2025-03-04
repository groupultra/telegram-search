<!-- Export command component -->
<script setup lang="ts">
import type { TelegramChat } from '@tg-search/core'
import type { DatabaseMessageType } from '@tg-search/db'
import type { ExportDetails } from '@tg-search/server'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useExport } from '../../apis/commands/useExport'
import { useSession } from '../../composables/useSession'
import CheckboxGroup from '../ui/CheckboxGroup.vue'
import ProgressBar from '../ui/ProgressBar.vue'
import RadioGroup from '../ui/RadioGroup.vue'
import SearchSelect from '../ui/SearchSelect.vue'
import SelectDropdown from '../ui/SelectDropdown.vue'
import StatusBadge from '../ui/StatusBadge.vue'

// Props
const props = defineProps<{
  chats: TelegramChat[]
}>()

const {
  executeExport,
  currentCommand,
  exportProgress,
  cleanup,
} = useExport()

const { checkConnection, isConnected } = useSession()

// Cleanup when component is unmounted
onUnmounted(() => {
  cleanup()
})

// Selected chat type
const selectedChatType = ref<'user' | 'group' | 'channel'>('user')
// Selected chat
const selectedChatId = ref<number>()
// Selected message types
const selectedMessageTypes = ref<DatabaseMessageType[]>(['text'])
// Selected export method
const selectedMethod = ref<'getMessage' | 'takeout'>('getMessage')
// 增量导出选项
const enableIncremental = ref<boolean>(false)
// 自定义开始消息ID
const customMinId = ref<number | undefined>(undefined)

// const canExport = computed(() => isConnected.value && selectedChatId.value && selectedMessageTypes.value.length > 0)

// Chat type options
const chatTypeOptions = [
  { label: '私聊', value: 'user' },
  { label: '群组', value: 'group' },
  { label: '频道', value: 'channel' },
]

// Message type options
const messageTypeOptions = [
  { label: '文本消息', value: 'text' },
  { label: '图片', value: 'photo' },
  { label: '视频', value: 'video' },
  { label: '文档', value: 'document' },
  { label: '贴纸', value: 'sticker' },
  { label: '其他', value: 'other' },
]

// Export method options
const exportMethodOptions = [
  { label: 'GetMessage', value: 'getMessage' },
  { label: 'Takeout', value: 'takeout' },
]

// Status icon based on current state
const statusIcon = computed((): string => {
  if (!currentCommand.value)
    return ''

  // TODO: replace with icon
  const iconMap: Record<string, string> = {
    running: '⟳',
    waiting: '⏱',
    completed: '✓',
    failed: '✗',
    default: '↻',
  }

  return iconMap[currentCommand.value.status] || iconMap.default
})

// 格式化数字
function formatNumber(num: number | undefined): string {
  if (num === undefined)
    return '0'
  return num.toLocaleString()
}

// Filtered chats based on selected type
const filteredChats = computed(() => {
  return props.chats.filter((chat: TelegramChat) => chat.type === selectedChatType.value)
})

// Format chat options for SearchSelect
const chatOptions = computed(() => {
  return filteredChats.value.map(chat => ({
    id: chat.id,
    label: chat.title || `Chat ${chat.id}`,
  }))
})

// Command status for UI display
const commandStatus = computed((): 'waiting' | 'running' | 'completed' | 'failed' => {
  if (!currentCommand.value)
    return 'waiting'
  return currentCommand.value.status as any
})

// Human-readable export status
const exportStatus = computed((): string => {
  if (!currentCommand.value) {
    return '准备导出'
  }

  const statusMap: Record<string, string> = {
    running: '导出中',
    waiting: '等待中',
    completed: '导出完成',
    failed: '导出失败',
    default: '准备导出',
  }

  return statusMap[currentCommand.value.status] || statusMap.default
})

// 检查连接状态
onMounted(async () => {
  await checkConnection(false) // 不自动跳转到登录页
})

// Export operation
async function handleExport() {
  // 检查是否已连接到Telegram
  if (!isConnected.value) {
    toast.error('请先连接Telegram以使用导出功能')
    return
  }

  // 验证所选项
  if (!selectedChatId.value) {
    toast.error('请选择要导出的聊天')
    return
  }

  if (selectedMessageTypes.value.length === 0) {
    toast.error('请至少选择一种消息类型')
    return
  }

  const toastId = toast.loading('正在准备导出...')

  // 准备导出参数
  const params = {
    chatId: selectedChatId.value,
    messageTypes: selectedMessageTypes.value,
    method: selectedMethod.value,
    incremental: enableIncremental.value,
    minId: customMinId.value,
  }

  try {
    const result = await executeExport(params)
    if (result.success) {
      toast.success('导出任务已开始', { id: toastId })
    }
    else {
      toast.error((result.error as Error)?.message || '导出失败', { id: toastId })
    }
  }
  catch (error) {
    toast.error(`导出错误: ${error instanceof Error ? error.message : '未知错误'}`, { id: toastId })
  }
}

// Computed properties for progress display
const isExporting = computed(() => currentCommand.value?.status === 'running')
const isWaiting = computed(() => currentCommand.value?.status === 'waiting')
const waitingTimeLeft = ref(0)

// Export details computed properties
const exportDetails = computed(() => {
  if (!currentCommand.value || !currentCommand.value.metadata) {
    return null
  }

  const metadata = currentCommand.value.metadata

  // TODO: interface
  return {
    totalMessages: metadata.totalMessages as number | undefined,
    processedMessages: metadata.processedMessages as number | undefined,
    failedMessages: metadata.failedMessages as number | undefined,
    totalDuration: metadata.totalDuration as number | undefined,
    estimatedTimeRemaining: metadata.estimatedTimeRemaining as number | undefined,
    currentSpeed: metadata.currentSpeed as number | undefined,
    currentBatch: metadata.currentBatch as number | undefined,
    totalBatches: metadata.totalBatches as number | undefined,
    error: metadata.error,
  } as ExportDetails
})

// Total messages and processed messages for progress display
const totalMessages = computed(() => {
  return exportDetails.value?.totalMessages
})

const processedMessages = computed(() => {
  return exportDetails.value?.processedMessages
})

// Wait time countdown
let waitTimerId: number | undefined

// TODO: extract
watch(() => currentCommand.value?.status, (status) => {
  if (status === 'waiting') {
    if (currentCommand.value?.metadata?.waitTime) {
      waitingTimeLeft.value = Math.ceil(
        (currentCommand.value.metadata.waitTime as number) / 1000,
      )
      if (waitTimerId)
        window.clearInterval(waitTimerId)
      waitTimerId = window.setInterval(() => {
        if (waitingTimeLeft.value <= 0) {
          if (waitTimerId)
            window.clearInterval(waitTimerId)
          return
        }
        waitingTimeLeft.value--
      }, 1000)
    }
  }
  else {
    if (waitTimerId) {
      window.clearInterval(waitTimerId)
      waitTimerId = undefined
    }
  }
})

// Format time (seconds) to human-readable string
function formatTime(seconds: number | string): string {
  if (typeof seconds === 'string') {
    seconds = Number.parseFloat(seconds)
  }

  if (!seconds || seconds < 0)
    return '未知'

  if (seconds < 60) {
    return `${Math.floor(seconds)}秒`
  }

  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}分${remainingSeconds > 0 ? `${remainingSeconds}秒` : ''}`
  }

  const hours = Math.floor(seconds / 3600)
  const remainingMinutes = Math.floor((seconds % 3600) / 60)
  return `${hours}小时${remainingMinutes > 0 ? `${remainingMinutes}分` : ''}`
}

// Format speed (messages per second) to human-readable string
function formatSpeed(messagesPerSecond: number | string): string {
  if (typeof messagesPerSecond === 'string') {
    messagesPerSecond = Number.parseFloat(messagesPerSecond)
  }

  if (messagesPerSecond >= 1) {
    return `${messagesPerSecond.toFixed(1)} 消息/秒`
  }

  const messagesPerMinute = messagesPerSecond * 60
  return `${messagesPerMinute.toFixed(1)} 消息/分钟`
}
</script>

<template>
  <div class="space-y-5">
    <!-- 未连接Telegram时的提示 -->
    <div v-if="!isConnected" class="mb-4 rounded-md bg-yellow-50 p-4 dark:bg-yellow-900/30">
      <div class="flex">
        <div class="flex-shrink-0">
          <div class="i-carbon-warning h-5 w-5 text-yellow-400" aria-hidden="true" />
        </div>
        <div class="ml-3">
          <h3 class="text-sm text-yellow-800 font-medium dark:text-yellow-200">
            未连接到Telegram
          </h3>
          <div class="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
            <p>要使用导出功能，您需要先连接到Telegram。</p>
          </div>
          <div class="mt-3">
            <router-link
              to="/login"
              class="rounded-md bg-yellow-50 px-2 py-1.5 text-sm text-yellow-800 font-medium dark:bg-yellow-900/50 hover:bg-yellow-100 dark:text-yellow-200 dark:hover:bg-yellow-800/50"
            >
              去连接
            </router-link>
          </div>
        </div>
      </div>
    </div>

    <!-- Export configuration -->
    <div class="overflow-hidden rounded-lg bg-white shadow-md dark:bg-gray-800 dark:text-gray-100">
      <div class="p-5">
        <h2 class="mb-3 text-lg font-semibold">
          导出设置
        </h2>

        <!-- Chat Type Selection -->
        <div class="mb-5">
          <SelectDropdown
            v-model="selectedChatType"
            :options="chatTypeOptions"
            label="会话类型"
            :disabled="isExporting"
          />
        </div>

        <!-- Chat Selection -->
        <div class="mb-5">
          <SearchSelect
            v-model="selectedChatId"
            :options="chatOptions"
            label="选择会话"
            placeholder="搜索会话..."
            :disabled="isExporting"
          />
        </div>

        <!-- Message Type Selection -->
        <div class="mb-5">
          <CheckboxGroup
            v-model="selectedMessageTypes"
            :options="messageTypeOptions"
            label="消息类型"
            :disabled="isExporting"
          />
        </div>

        <!-- Export Method Selection -->
        <div class="mb-5">
          <RadioGroup
            v-model="selectedMethod"
            :options="exportMethodOptions"
            label="导出方式"
            :disabled="isExporting"
          />
        </div>

        <!-- Incremental Export Option -->
        <div class="mb-5">
          <label class="flex cursor-pointer items-center gap-2">
            <input
              v-model="enableIncremental"
              type="checkbox"
              class="h-4 w-4 border-gray-300 rounded text-blue-600 focus:ring-blue-500"
              :disabled="isExporting"
            >
            <span class="text-sm">增量导出 (仅导出上次导出之后的新消息)</span>
          </label>
        </div>

        <!-- Custom Min ID -->
        <div v-if="!enableIncremental" class="mb-5">
          <label class="mb-2 block text-sm text-gray-700 font-medium dark:text-gray-300">
            自定义起始消息ID (可选)
          </label>
          <input
            v-model="customMinId"
            type="number"
            placeholder="从此ID开始导出（留空则从最新消息开始）"
            class="w-full border border-gray-300 rounded-md p-2.5 text-gray-700 dark:border-gray-600 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:border-blue-500 dark:focus:ring-blue-700/30"
            :disabled="isExporting"
          >
        </div>

        <!-- Submit Button -->
        <button
          class="group relative w-full overflow-hidden rounded-md bg-blue-500 px-4 py-3 text-white font-medium shadow-sm transition-all duration-300 dark:bg-blue-600 hover:bg-blue-600 disabled:opacity-70 hover:shadow-md dark:hover:bg-blue-700"
          :disabled="isExporting || !selectedChatId"
          @click="handleExport"
        >
          <span v-if="isExporting" class="flex items-center justify-center">
            <span class="mr-2 inline-block animate-spin">⟳</span>
            <span>导出中...</span>
          </span>
          <span v-else class="flex items-center justify-center">
            <span class="mr-2">↻</span>
            <span>开始导出</span>
          </span>
          <span
            class="absolute bottom-0 left-0 h-1 bg-blue-400 transition-all duration-500"
            :class="{ 'w-full': isExporting, 'w-0': !isExporting }"
          />
        </button>
      </div>
    </div>

    <!-- Export progress -->
    <div
      v-if="currentCommand"
      class="overflow-hidden rounded-lg bg-white shadow-md transition-all duration-300 dark:bg-gray-800 dark:text-gray-100"
    >
      <div class="p-5">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="flex items-center text-lg font-semibold">
            <span class="mr-2">导出状态</span>
            <span
              v-if="currentCommand.status === 'running'"
              class="inline-block animate-spin text-yellow-500"
            >⟳</span>
          </h2>
          <StatusBadge
            :status="commandStatus"
            :label="exportStatus"
            :icon="statusIcon"
          />
        </div>

        <!-- Progress bar -->
        <div class="mb-5">
          <ProgressBar
            :progress="exportProgress"
            :status="commandStatus"
          />
        </div>

        <!-- 等待提示 -->
        <div v-if="isWaiting" class="animate-fadeIn mb-5 rounded-md bg-yellow-50 p-3 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
          <p class="flex items-center">
            <span class="mr-2 text-lg">⏱</span>
            <span>Telegram API 限制中...将在 {{ waitingTimeLeft }} 秒后恢复。</span>
          </p>
        </div>

        <!-- Status message -->
        <div v-if="currentCommand.message" class="mb-4 text-sm text-gray-700 dark:text-gray-300">
          <p class="mb-1 font-medium">
            当前状态:
          </p>
          <p>
            {{ currentCommand.message }}
            <template v-if="currentCommand.message?.includes('已处理')">
              <span
                v-if="!!totalMessages && !!processedMessages"
                class="text-blue-600 font-medium dark:text-blue-400"
              >
                ({{ formatNumber(processedMessages) }} / {{ formatNumber(totalMessages) }} 条)
              </span>
              <span
                v-else-if="exportDetails?.totalMessages"
                class="text-blue-600 font-medium dark:text-blue-400"
              >
                (共 {{ formatNumber(exportDetails.totalMessages) }} 条)
              </span>
            </template>
          </p>
        </div>

        <!-- Export details -->
        <div v-if="exportDetails" class="mt-6 space-y-4">
          <h3 class="text-gray-800 font-medium dark:text-gray-200">
            导出详情
          </h3>

          <div class="rounded-md bg-gray-50 p-4 dark:bg-gray-700/50">
            <div class="text-sm space-y-3">
              <div v-if="exportDetails.totalMessages !== undefined" class="flex items-center justify-between">
                <span class="text-gray-600 dark:text-gray-300">总消息数：</span>
                <span class="font-medium">{{ formatNumber(exportDetails.totalMessages) }}</span>
              </div>

              <div v-if="exportDetails.processedMessages !== undefined" class="flex items-center justify-between">
                <span class="text-gray-600 dark:text-gray-300">已处理消息：</span>
                <span class="flex items-center font-medium">
                  {{ formatNumber(exportDetails.processedMessages) }}
                  <template v-if="exportDetails.totalMessages !== undefined">
                    <span class="mx-1">/</span> {{ formatNumber(exportDetails.totalMessages) }}
                  </template>
                </span>
              </div>

              <div v-if="exportDetails.failedMessages" class="flex items-center justify-between text-red-600 dark:text-red-400">
                <span>失败消息：</span>
                <span class="font-medium">{{ formatNumber(exportDetails.failedMessages) }}</span>
              </div>

              <div v-if="exportDetails.currentBatch && exportDetails.totalBatches" class="flex items-center justify-between">
                <span class="text-gray-600 dark:text-gray-300">当前批次：</span>
                <span class="font-medium">{{ exportDetails.currentBatch }} / {{ exportDetails.totalBatches }}</span>
              </div>
            </div>
          </div>

          <div class="rounded-md bg-gray-50 p-4 dark:bg-gray-700/50">
            <div class="text-sm space-y-3">
              <div v-if="exportDetails.currentSpeed" class="flex items-center justify-between">
                <span class="text-gray-600 dark:text-gray-300">当前速度：</span>
                <span class="font-medium">{{ formatSpeed(exportDetails.currentSpeed) }}</span>
              </div>

              <div v-if="exportDetails.estimatedTimeRemaining" class="flex items-center justify-between">
                <span class="text-gray-600 dark:text-gray-300">预计剩余时间：</span>
                <span class="font-medium">{{ formatTime(exportDetails.estimatedTimeRemaining) }}</span>
              </div>

              <div v-if="exportDetails.totalDuration" class="flex items-center justify-between">
                <span class="text-gray-600 dark:text-gray-300">总耗时：</span>
                <span class="font-medium">{{ formatTime(exportDetails.totalDuration) }}</span>
              </div>
            </div>
          </div>

          <div v-if="exportDetails.error" class="animate-fadeIn mt-4 rounded-md bg-red-50 p-4 text-red-700 dark:bg-red-900/50 dark:text-red-100">
            <p class="mb-2 font-medium">
              错误信息:
            </p>
            <div v-if="typeof exportDetails.error === 'string'" class="text-sm">
              {{ exportDetails.error }}
            </div>
            <div v-else class="text-sm">
              <div>{{ exportDetails.error.name }}: {{ exportDetails.error.message }}</div>
              <pre v-if="exportDetails.error.stack" class="mt-3 overflow-auto rounded-md bg-red-100 p-2 text-xs dark:bg-red-900/50">{{ exportDetails.error.stack }}</pre>
            </div>
          </div>
        </div>

        <!-- Completion message -->
        <div
          v-if="currentCommand.status === 'completed'"
          class="animate-fadeIn mt-5 rounded-md bg-green-50 p-3 text-green-700 dark:bg-green-900/50 dark:text-green-100"
        >
          <p class="flex items-center">
            <span class="mr-2 text-lg">✓</span>
            <span>导出已完成！您可以在数据库中查看导出的消息。</span>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-fadeIn {
  animation: fadeIn 0.5s ease-in-out;
}

.animate-spin {
  animation: spin 1.5s linear infinite;
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}
</style>
