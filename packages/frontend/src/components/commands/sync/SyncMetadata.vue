<script setup lang="ts">
import type { SyncDetails } from '@tg-search/server'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { useSync } from '../../../apis/commands/useSync'
import { useSession } from '../../../composables/useSession'

// State management
const { executeSync, currentCommand, syncProgress, cleanup } = useSync()
const { checkConnection, isConnected } = useSession()
const isSyncing = computed(() => currentCommand.value?.status === 'running')
const router = useRouter()
const showConnectButton = ref(false)

const { t } = useI18n()

// 检查连接状态
onMounted(async () => {
  const connected = await checkConnection(false) // 不自动跳转到登录页
  if (!connected) {
    // 如果未连接，显示连接按钮，而不是自动跳转
    showConnectButton.value = true
  }
})

// Cleanup when component is unmounted
onUnmounted(() => {
  cleanup()
})

// Parse sync details from metadata
const syncDetails = computed((): SyncDetails | null => {
  if (!currentCommand.value?.metadata)
    return null

  const metadata = currentCommand.value.metadata
  return {
    totalChats: metadata.totalChats as number | undefined,
    totalFolders: metadata.totalFolders as number | undefined,
    processedChats: metadata.processedChats as number | undefined,
    processedFolders: metadata.processedFolders as number | undefined,
  }
})

// Human-readable sync status
const syncStatus = computed((): string => {
  if (!currentCommand.value)
    return ''

  const statusMap: Record<string, string> = {
    running: t('component.sync_command.running'),
    waiting: t('component.sync_command.waiting'),
    completed: t('component.sync_command.completed'),
    failed: t('component.sync_command.failed'),
    default: t('component.sync_command.prepare_sync'),
  }

  return statusMap[currentCommand.value.status] || statusMap.default
})

// Status icon based on current state
const statusIcon = computed((): string => {
  if (!currentCommand.value)
    return ''

  const iconMap: Record<string, string> = {
    running: '⟳',
    waiting: '⏱',
    completed: '✓',
    failed: '✗',
    default: '↻',
  }

  return iconMap[currentCommand.value.status] || iconMap.default
})

// Format numbers with commas
function formatNumber(num: number | undefined): string {
  if (num === undefined)
    return '0'
  return num.toLocaleString()
}

// Start sync command
async function handleSync(): Promise<void> {
  // 检查是否已连接到Telegram
  if (!isConnected.value) {
    toast.error(t('component.sync_command.not_connect'))
    return
  }

  const toastId = toast.loading(t('component.sync_command.prepare_sync_'))

  try {
    const result = await executeSync({})
    if (!result.success) {
      toast.error(result.error || t('component.sync_command.sync_error'), { id: toastId })
    }
    else {
      toast.success(t('component.sync_command.sync_success'), { id: toastId })
    }
  }
  catch (error) {
    toast.error(t('component.sync_command.sync_failure', { error: error instanceof Error ? error.message : '未知错误' }), { id: toastId })
  }
}

// 跳转到登录页
function goToLogin(): void {
  const currentPath = router.currentRoute.value.fullPath
  router.push(`/login?redirect=${encodeURIComponent(currentPath)}`)
}
</script>

<template>
  <div class="overflow-hidden rounded-lg bg-white shadow-md transition-all duration-300 dark:bg-gray-800 dark:text-gray-100">
    <div class="p-5">
      <h2 class="mb-3 text-lg font-semibold">
        {{ t('component.sync_command.data_sync') }}
      </h2>
      <p class="mb-4 text-sm text-gray-600 dark:text-gray-300">
        {{ t('component.sync_command.sync_cloud') }}
      </p>

      <!-- 未连接Telegram时的提示 -->
      <div v-if="!isConnected && showConnectButton" class="mb-4 rounded-md bg-blue-50 p-4 dark:bg-blue-900/30">
        <div class="flex">
          <div class="flex-shrink-0">
            <div class="i-lucide-information h-5 w-5 text-blue-400" aria-hidden="true" />
          </div>
          <div class="ml-3 flex-1 md:flex md:justify-between">
            <p class="text-sm text-blue-700 dark:text-blue-300">
              {{ t('component.sync_command.need_connect') }}
            </p>
            <p class="mt-3 text-sm md:ml-6 md:mt-0">
              <button
                class="whitespace-nowrap text-blue-700 font-medium dark:text-blue-300 hover:text-blue-600 dark:hover:text-blue-200"
                @click="goToLogin"
              >
                {{ t('component.sync_command.connect_to_telegram') }}
                <span aria-hidden="true"> &rarr;</span>
              </button>
            </p>
          </div>
        </div>
      </div>

      <!-- Sync button -->
      <div class="mb-5">
        <button
          type="button"
          class="w-full flex items-center justify-center rounded-md bg-blue-600 px-4 py-3 text-sm text-white font-medium shadow-sm transition-colors disabled:cursor-not-allowed dark:bg-blue-700 hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:hover:bg-blue-600"
          :disabled="isSyncing || !isConnected"
          @click="handleSync"
        >
          <span v-if="isSyncing" class="mr-2 inline-block animate-spin text-lg">{{ statusIcon }}</span>
          <span>{{ isSyncing ? syncStatus : t('component.sync_command.start_sync') }}</span>
        </button>
        <p v-if="isConnected" class="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {{ t('component.sync_command.start_sync_new_message') }}
        </p>
      </div>
    </div>
  </div>

  <!-- Synchronous regime -->
  <div class="overflow-hidden rounded-lg bg-white shadow-md transition-all duration-300 dark:bg-gray-800 dark:text-gray-100">
    <div class="p-5">
      <h2 class="mb-3 text-lg font-semibold">
        {{ t('component.sync_command.sync_status') }}
      </h2>

      <!-- 同步状态显示 -->
      <div v-if="currentCommand" class="space-y-4">
        <div class="flex items-center justify-between">
          <span class="text-gray-600 dark:text-gray-400">{{ t('component.sync_command.status') }}</span>
          <span
            class="font-medium" :class="{
              'text-blue-600': currentCommand.status === 'waiting',
              'text-yellow-600': currentCommand.status === 'running',
              'text-green-600': currentCommand.status === 'completed',
              'text-red-600': currentCommand.status === 'failed',
            }"
          >{{ syncStatus }}</span>
        </div>

        <div class="flex items-center justify-between">
          <span class="text-gray-600 dark:text-gray-400">{{ t('component.sync_command.progress') }}</span>
          <span class="font-medium">{{ syncProgress }}%</span>
        </div>

        <!-- 错误信息显示 -->
        <div v-if="currentCommand.error" class="mt-2 rounded-md bg-red-50 p-3 text-red-700 dark:bg-red-900/50 dark:text-red-100">
          <p class="text-sm">
            {{ currentCommand.error }}
          </p>
        </div>
      </div>

      <!-- 无同步任务时的提示 -->
      <div v-else class="text-center text-gray-500 dark:text-gray-400">
        {{ t('component.sync_command.no_sync_task') }}
      </div>
    </div>
  </div>
</template>
