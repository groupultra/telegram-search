<script setup lang="ts">
import type { SyncDetails } from '@tg-search/server'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { useSync } from '../../apis/commands/useSync'
import { useSession } from '../../composables/useSession'

// State management
const { executeSync, currentCommand, syncProgress, cleanup } = useSync()
const { checkConnection, isConnected } = useSession()
const isSyncing = computed(() => currentCommand.value?.status === 'running')
// const canStartSync = computed(() => (!currentCommand.value
//   || ['completed', 'failed'].includes(currentCommand.value.status)) && isConnected.value)
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
  if (!currentCommand.value?.metadata) {
    return null
  }

  const metadata = currentCommand.value.metadata
  // TODO: interface
  return {
    totalChats: metadata.totalChats as number | undefined,
    totalFolders: metadata.totalFolders as number | undefined,
    processedChats: metadata.processedChats as number | undefined,
    processedFolders: metadata.processedFolders as number | undefined,
  }
})

// Human-readable sync status
const syncStatus = computed((): string => {
  if (!currentCommand.value) {
    return ''
  }

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
function goToLogin() {
  const currentPath = router.currentRoute.value.fullPath
  router.push(`/login?redirect=${encodeURIComponent(currentPath)}`)
}
</script>

<template>
  <div class="space-y-5">
    <!-- Sync Control Panel -->
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
              <div class="i-carbon-information h-5 w-5 text-blue-400" aria-hidden="true" />
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

    <!-- Sync Progress Panel -->
    <div
      v-if="currentCommand"
      class="overflow-hidden rounded-lg bg-white shadow-md transition-all duration-300 dark:bg-gray-800 dark:text-gray-100"
    >
      <div class="p-5">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="flex items-center text-lg font-semibold">
            <span class="mr-2">{{ t('component.sync_command.sync_status') }}</span>
            <span
              v-if="currentCommand.status === 'running'"
              class="inline-block animate-spin text-yellow-500"
            >⟳</span>
          </h2>
          <span
            class="flex items-center rounded-full px-3 py-1 text-sm font-medium transition-colors"
            :class="{
              'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100':
                currentCommand.status === 'waiting',
              'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100':
                currentCommand.status === 'running',
              'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100':
                currentCommand.status === 'completed',
              'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100':
                currentCommand.status === 'failed',
            }"
          >
            <span class="mr-1.5">{{ statusIcon }}</span>
            <span>{{ syncStatus }}</span>
          </span>
        </div>

        <!-- Progress bar -->
        <div class="mb-5">
          <div class="h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              class="h-3 rounded-full transition-all duration-500 ease-in-out"
              :class="{
                'bg-blue-600 animate-pulse': currentCommand?.status === 'waiting',
                'bg-yellow-500': currentCommand?.status === 'running',
                'bg-green-500': currentCommand?.status === 'completed',
                'bg-red-500': currentCommand?.status === 'failed',
              }"
              :style="{ width: `${syncProgress}%` }"
            />
          </div>
          <div class="mt-2 flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>{{ t('component.sync_command.progress') }}</span>
            <span class="font-medium">{{ syncProgress }}%</span>
          </div>
        </div>

        <!-- Sync details -->
        <div v-if="syncDetails" class="mt-4 rounded-md bg-gray-50 p-4 space-y-3 dark:bg-gray-700/50">
          <h3 class="mb-2 text-gray-700 font-medium dark:text-gray-200">
            {{ t('component.sync_command.sync:detail') }}
          </h3>
          <div
            v-if="syncDetails.totalChats !== undefined && syncDetails.processedChats !== undefined"
            class="flex items-center justify-between"
          >
            <span class="text-gray-600 dark:text-gray-300">{{ t('component.sync_command.chat_sync') }}</span>
            <span class="font-medium">{{ formatNumber(syncDetails.processedChats) }} / {{ formatNumber(syncDetails.totalChats) }}</span>
          </div>
          <div
            v-if="syncDetails.totalFolders !== undefined && syncDetails.processedFolders !== undefined"
            class="flex items-center justify-between"
          >
            <span class="text-gray-600 dark:text-gray-300">{{ t('component.sync_command.folder_sync') }}</span>
            <span class="font-medium">{{ formatNumber(syncDetails.processedFolders) }} / {{ formatNumber(syncDetails.totalFolders) }}</span>
          </div>

          <!-- Error message if sync failed -->
          <div
            v-if="currentCommand.status === 'failed' && currentCommand.error"
            class="animate-fadeIn mt-4 rounded-md bg-red-50 p-3 text-red-700 dark:bg-red-900/50 dark:text-red-100"
          >
            <p class="mb-1 font-medium">
              {{ t('component.sync_command.error_message') }}
            </p>
            <p class="text-sm">
              {{ currentCommand.error }}
            </p>
          </div>
        </div>

        <!-- Completion message -->
        <div
          v-if="currentCommand.status === 'completed'"
          class="animate-fadeIn mt-4 rounded-md bg-green-50 p-3 text-green-700 dark:bg-green-900/50 dark:text-green-100"
        >
          <p class="flex items-center">
            <span class="mr-2 text-lg">✓</span>
            <span>{{ t('component.sync_command.sync_success_data') }}</span>
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
</style>
