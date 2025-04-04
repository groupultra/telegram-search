<script setup lang="ts">
import type { TelegramChat } from '@tg-search/core'
import type { DatabaseMessageType } from '@tg-search/db'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { useExport } from '../../apis/commands/useExport'
import { useChats } from '../../apis/useChats'
import ExportStatus from '../../components/export/ExportStatus.vue'
import NeedLogin from '../../components/NeedLogin.vue'
import { useChatTypeOptions, useExportMethodOptions, useMessageTypeOptions } from '../../composables/useOptions'
import { useSession } from '../../composables/useSession'

const {
  executeExport,
  currentCommand,
  exportProgress,
  cleanup,
} = useExport()
const { checkConnection, isConnected } = useSession()

const { t } = useI18n()
const { chats, loadChats } = useChats()
const chatTypeOptions = useChatTypeOptions()
const messageTypeOptions = useMessageTypeOptions()
const exportMethodOptions = useExportMethodOptions()

// Wait time countdown
let waitTimerId: number | undefined

const selectedChatType = ref<'user' | 'group' | 'channel'>('user')
const selectedChatId = ref<number>()
const selectedMessageTypes = ref<DatabaseMessageType[]>(['text'])
const selectedMethod = ref<'getMessage' | 'takeout'>('getMessage')
const enableIncremental = ref<boolean>(false)
const customMinId = ref<number | undefined>(undefined)
const waitingTimeLeft = ref(0)
const startTime = ref<number | null>(null)
const estimatedTimeLeft = ref<number | null>(null)
const lastProcessedCount = ref<number>(0)
const speedHistory = ref<number[]>([])
const lastUpdateTime = ref<number | null>(null)

const filteredChats = computed(() => {
  return chats.value.filter((chat: TelegramChat) => chat.type === selectedChatType.value)
})

const chatOptions = computed(() => {
  return filteredChats.value.map(chat => ({
    id: chat.id,
    label: chat.title || `Chat ${chat.id}`,
  }))
})

onMounted(async () => {
  loadChats()
  await checkConnection(false)
})

onUnmounted(() => {
  cleanup()
  resetEstimation()
  if (waitTimerId) {
    window.clearInterval(waitTimerId)
    waitTimerId = undefined
  }
})

// 计算移动平均速度（每分钟处理的消息数）
function calculateMovingAverageSpeed(currentCount: number, currentTime: number) {
  const maxHistoryLength = 10 // 最多保存10个历史速度记录

  if (lastUpdateTime.value && lastProcessedCount.value) {
    const timeDiff = (currentTime - lastUpdateTime.value) / 1000 // 转换为秒
    const countDiff = currentCount - lastProcessedCount.value

    if (timeDiff > 0) {
      const currentSpeed = (countDiff / timeDiff) * 60 // 转换为每分钟的速度
      speedHistory.value.push(currentSpeed)

      // 只保留最近的记录
      if (speedHistory.value.length > maxHistoryLength) {
        speedHistory.value.shift()
      }
    }
  }

  lastUpdateTime.value = currentTime
  lastProcessedCount.value = currentCount

  if (speedHistory.value.length === 0)
    return 0

  // 计算加权移动平均，最近的速度权重更大
  const weights = speedHistory.value.map((_, index) => index + 1)
  const weightSum = weights.reduce((a, b) => a + b, 0)

  return speedHistory.value.reduce((sum, speed, index) => {
    return sum + (speed * weights[index])
  }, 0) / weightSum
}

// 计算预估剩余时间
function calculateEstimatedTime() {
  if (!currentCommand.value?.metadata
    || !currentCommand.value.metadata.totalMessages
    || !currentCommand.value.metadata.processedMessages) {
    return
  }

  const currentTime = Date.now()
  const processedCount = currentCommand.value.metadata.processedMessages as number
  const totalCount = currentCommand.value.metadata.totalMessages as number

  // 计算当前的移动平均速度
  const avgSpeed = calculateMovingAverageSpeed(processedCount, currentTime)

  if (avgSpeed <= 0) {
    return
  }

  const remainingCount = totalCount - processedCount
  const remainingTimeInMinutes = remainingCount / avgSpeed

  // 转换为秒
  estimatedTimeLeft.value = Math.round(remainingTimeInMinutes * 60)
}

// 重置状态
function resetEstimation() {
  startTime.value = null
  estimatedTimeLeft.value = null
  lastProcessedCount.value = 0
  speedHistory.value = []
  lastUpdateTime.value = null
}

// Export operation
async function handleExport() {
  resetEstimation()
  startTime.value = Date.now()

  // 检查是否已连接到Telegram
  if (!isConnected.value) {
    toast.error(t('component.export_command.not_connect'))
    return
  }

  // 验证所选项
  if (!selectedChatId.value) {
    toast.error(t('component.export_command.select_chat_v'))
    return
  }

  if (selectedMessageTypes.value.length === 0) {
    toast.error(t('component.export_command.select_one_chat'))
    return
  }

  const toastId = toast.loading(t('component.export_command.preparing_for_export'))

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
      toast.success(t('component.export_command.export_task_started'), { id: toastId })
    }
    else {
      toast.error((result.error as Error)?.message || t('component.export_command.failure_export'), { id: toastId })
    }
  }
  catch (error) {
    toast.error(t('component.export_command.export_error', { error: error instanceof Error ? error.message : '未知错误' }), { id: toastId })
  }
}

// Computed properties for progress display
const isExporting = computed(() => currentCommand.value?.status === 'running')

// Wait time countdown
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

// 监听进度变化
watch(() => currentCommand.value?.metadata?.processedMessages, () => {
  if (currentCommand.value?.status === 'running') {
    calculateEstimatedTime()
  }
})

// 监听状态变化
watch(() => currentCommand.value?.status, (newStatus) => {
  if (newStatus === 'completed' || newStatus === 'failed') {
    resetEstimation()
  }
})
</script>

<template>
  <div class="space-y-5">
    <NeedLogin :is-connected="isConnected" />

    <!-- Export configuration -->
    <div class="overflow-hidden rounded-lg bg-white dark:bg-gray-800 dark:text-gray-100">
      <div class="p-5">
        <h2 class="mb-3 text-lg font-semibold">
          {{ t("component.export_command.export_settings") }}
        </h2>

        <!-- Chat Type Selection -->
        <div class="mb-5">
          <SelectDropdown
            v-model="selectedChatType"
            :options="chatTypeOptions"
            :label="t('component.export_command.chat_type')"
            :disabled="isExporting"
          />
        </div>

        <!-- Chat Selection -->
        <div class="mb-5">
          <SearchSelect
            v-model="selectedChatId"
            :options="chatOptions"
            :label="t('component.export_command.select_chat')"
            :placeholder="t('component.export_command.placeholder_search')"
            :disabled="isExporting"
          />
        </div>

        <!-- Message Type Selection -->
        <div class="mb-5">
          <CheckboxGroup
            v-model="selectedMessageTypes"
            :options="messageTypeOptions"
            :label="t('component.export_command.message_type')"
            :disabled="isExporting"
          />
        </div>

        <!-- Export Method Selection -->
        <div class="mb-5">
          <RadioGroup
            v-model="selectedMethod"
            :options="exportMethodOptions"
            :label="t('component.export_command.export_method')"
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
            <span class="text-sm">{{ t('component.export_command.incremental_export') }}</span>
          </label>
        </div>

        <!-- Custom Min ID -->
        <div v-if="!enableIncremental" class="mb-5">
          <label class="mb-2 block text-sm text-gray-700 font-medium dark:text-gray-300">
            {{ t('component.export_command.custom_id') }}
          </label>
          <input
            v-model="customMinId"
            type="number"
            :placeholder="t('component.export_command.placeholder_id')"
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
            <span>{{ t('component.export_command.exporting') }}</span>
          </span>
          <span v-else class="flex items-center justify-center">
            <span class="mr-2">↻</span>
            <span>{{ t('component.export_command.start_export') }}</span>
          </span>
          <span
            class="absolute bottom-0 left-0 h-1 bg-blue-400 transition-all duration-500"
            :class="{ 'w-full': isExporting, 'w-0': !isExporting }"
          />
        </button>
      </div>
    </div>

    <!-- Export Status -->
    <ExportStatus
      :command="currentCommand"
      :progress="exportProgress"
      :waiting-time-left="waitingTimeLeft"
      :estimated-time-left="estimatedTimeLeft"
    />
  </div>
</template>
