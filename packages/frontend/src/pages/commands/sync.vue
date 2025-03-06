<script setup lang="ts">
import type { Command } from '@tg-search/server'
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { useMultiSync } from '../../apis/commands/useMultiSync'
import { useSyncMetadata } from '../../apis/commands/useSyncMetadata'
import { useChats } from '../../apis/useChats'
import NeedLogin from '../../components/NeedLogin.vue'
import Pagination from '../../components/ui/Pagination.vue'
import ProgressBar from '../../components/ui/ProgressBar.vue'
import SelectDropdown from '../../components/ui/SelectDropdown.vue'
import StatusBadge from '../../components/ui/StatusBadge.vue'
import { useChatTypeOptions } from '../../composables/useOptions'
import { usePagination } from '../../composables/usePagination'
import { useSession } from '../../composables/useSession'
import { useStatus } from '../../composables/useStatus'
import { formatNumberToReadable } from '../../helper'

// Composables
const { t } = useI18n()
const { chats, loadChats } = useChats()
const { executeMultiSync, currentCommand: multiCommand, syncProgress: multiProgress, updateCommand: updateMultiCommand } = useMultiSync()
const { executeSync, currentCommand: syncCommand, syncProgress: metaProgress, updateCommand: updateSyncCommand } = useSyncMetadata()
const { checkConnection, isConnected } = useSession()

// State
const selectedChats = ref<number[]>([])
const priorities = ref<Record<number, number>>({})
const showPriorityDialog = ref(false)
const showConnectButton = ref(false)
const selectedType = ref<string>('user')
const searchQuery = ref('')
const currentPage = ref(1)
const waitingTimeLeft = ref(0)

const CHAT_TYPE_OPTIONS = useChatTypeOptions()

// Computed
const currentCommand = computed(() => multiCommand.value || syncCommand.value)
const commandProgress = computed(() => multiProgress.value || metaProgress.value || 0)
const isSyncing = computed(() => currentCommand.value?.status === 'running')
const isWaiting = computed(() => currentCommand.value?.status === 'waiting')

const gridOptions = computed(() => chats.value.map(chat => ({
  id: chat.id,
  title: chat.title,
  subtitle: `ID: ${chat.id}`,
  type: chat.type,
})))

const filteredOptions = computed(() => {
  let filtered = gridOptions.value

  if (selectedType.value)
    filtered = filtered.filter(option => option.type === selectedType.value)

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(option =>
      option.title.toLowerCase().includes(query)
      || option.subtitle?.toLowerCase().includes(query)
      || option.id.toString().includes(query),
    )
  }

  return filtered.sort((a, b) => {
    const aSelected = selectedChats.value.includes(a.id)
    const bSelected = selectedChats.value.includes(b.id)
    if (aSelected && !bSelected)
      return -1
    if (!aSelected && bSelected)
      return 1
    return 0
  })
})

const commandStatus = computed((): 'waiting' | 'running' | 'completed' | 'failed' => {
  if (!currentCommand.value)
    return 'waiting'
  return currentCommand.value.status as any
})

const { statusText, statusIcon } = useStatus(currentCommand.value?.status)

const { totalPages, paginatedData } = usePagination({
  defaultPage: 1,
  defaultPageSize: 12,
})

const paginatedOptions = computed(() => {
  return paginatedData(filteredOptions.value)
})

const selectedCount = computed(() => selectedChats.value.length)

function isSelected(id: number): boolean {
  return selectedChats.value.includes(id)
}

function toggleSelection(id: number): void {
  const index = selectedChats.value.indexOf(id)
  if (index === -1)
    selectedChats.value.push(id)
  else
    selectedChats.value.splice(index, 1)
}

function getChatTitle(chatId: number) {
  return chats.value.find(c => c.id === chatId)?.title || chatId
}

async function startSync() {
  if (!isConnected.value) {
    toast.error(t('component.sync_command.not_connect'))
    return
  }

  if (selectedChats.value.length === 0)
    return

  showPriorityDialog.value = true
}

async function confirmPriorities() {
  showPriorityDialog.value = false
  const toastId = toast.loading(t('component.sync_command.prepare_sync_'))

  const initialCommand: Command = {
    id: Date.now().toString(),
    type: 'sync',
    status: 'running',
    progress: 0,
    message: t('component.sync_command.prepare_sync'),
    metadata: {
      totalChats: selectedChats.value.length,
      processedChats: 0,
      failedChats: 0,
    },
  }
  updateMultiCommand(initialCommand)

  try {
    await executeMultiSync({
      chatIds: selectedChats.value,
      priorities: priorities.value,
    })
    toast.success(t('component.sync_command.sync_success'), { id: toastId })
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    toast.error(t('component.sync_command.sync_failure', { error: errorMessage }), { id: toastId })
    console.error('Failed to start sync:', error)

    const failedCommand: Command = {
      id: Date.now().toString(),
      type: 'sync',
      status: 'failed',
      progress: 0,
      message: errorMessage,
    }
    updateMultiCommand(failedCommand)
  }
}

async function syncMetadata() {
  if (!isConnected.value) {
    toast.error(t('component.sync_command.not_connect'))
    return
  }

  const toastId = toast.loading(t('component.sync_command.prepare_sync_'))

  const initialCommand: Command = {
    id: Date.now().toString(),
    type: 'sync',
    status: 'running',
    progress: 0,
    message: t('component.sync_command.prepare_sync'),
    metadata: {
      totalChats: 0,
      processedChats: 0,
      failedChats: 0,
    },
  }
  updateSyncCommand(initialCommand)

  try {
    const result = await executeSync({})
    if (!result.success) {
      const errorMessage = String(result.error || t('component.sync_command.sync_error'))
      toast.error(errorMessage, { id: toastId })

      const failedCommand: Command = {
        id: Date.now().toString(),
        type: 'sync',
        status: 'failed',
        progress: 0,
        message: errorMessage,
      }
      updateSyncCommand(failedCommand)
    }
    else {
      toast.success(t('component.sync_command.sync_success'), { id: toastId })
    }
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    toast.error(t('component.sync_command.sync_failure', { error: errorMessage }), { id: toastId })

    const failedCommand: Command = {
      id: Date.now().toString(),
      type: 'sync',
      status: 'failed',
      progress: 0,
      message: errorMessage,
    }
    updateSyncCommand(failedCommand)
  }
}

// Watchers
watch([selectedType, searchQuery], () => {
  currentPage.value = 1
})

watch(() => currentCommand.value?.status, (status) => {
  if (status === 'waiting' && currentCommand.value?.metadata?.waitTime) {
    waitingTimeLeft.value = Math.ceil(currentCommand.value.metadata.waitTime as number / 1000)
    const waitTimer = setInterval(() => {
      if (waitingTimeLeft.value <= 0) {
        clearInterval(waitTimer)
        return
      }
      waitingTimeLeft.value--
    }, 1000)
  }
})

// Lifecycle
onMounted(async () => {
  await loadChats()
  const connected = await checkConnection(false)
  if (!connected)
    showConnectButton.value = true
})
</script>

<template>
  <div class="space-y-4">
    <NeedLogin :is-connected="isConnected" />

    <div class="flex items-center justify-between">
      <h3 class="text-lg font-medium">
        {{ t('component.sync_command.select_chats') }}
      </h3>
      <div class="flex items-center gap-2">
        <span class="text-sm text-gray-500">
          {{ t('component.sync_command.selected_count', { count: selectedCount }) }}
        </span>
        <button
          class="rounded-md bg-blue-500 px-4 py-2 text-white disabled:cursor-not-allowed hover:bg-blue-600 disabled:opacity-50"
          :disabled="!isConnected"
          @click="syncMetadata"
        >
          {{ t('component.sync_command.metadata_sync') }}
        </button>
        <button
          class="rounded-md bg-blue-500 px-4 py-2 text-white disabled:cursor-not-allowed hover:bg-blue-600 disabled:opacity-50"
          :disabled="selectedChats.length === 0 || !isConnected"
          @click="startSync"
        >
          <span v-if="isSyncing" class="mr-2 inline-block animate-spin text-lg">
            <Icon :icon="statusIcon" />
          </span>
          <span>{{ isSyncing ? statusText : t('component.sync_command.start_sync') }}</span>
        </button>
      </div>
    </div>

    <div class="space-y-4">
      <!-- Filters -->
      <div class="flex flex-col items-start gap-4 md:flex-row md:items-end">
        <!-- Type Selection -->
        <div class="w-full md:w-48">
          <SelectDropdown
            v-model="selectedType"
            :options="CHAT_TYPE_OPTIONS"
            :label="t('component.grid_selector.type')"
          />
        </div>

        <!-- Search Input -->
        <div class="flex-1">
          <input
            v-model="searchQuery"
            type="text"
            class="w-full border border-gray-300 rounded-md px-4 py-2 dark:border-gray-600 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            :placeholder="t('component.export_command.placeholder_search')"
          >
        </div>
      </div>

      <!-- Grid List -->
      <TransitionGroup
        name="grid-list"
        tag="div"
        class="grid gap-4 lg:grid-cols-3 md:grid-cols-2"
      >
        <button
          v-for="option in paginatedOptions"
          :key="option.id"
          class="grid-item relative w-full flex cursor-pointer items-center border rounded-lg p-4 text-left space-x-3 hover:shadow-md"
          :class="{
            'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md selected': isSelected(option.id),
            'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600': !isSelected(option.id),
          }"
          @click="toggleSelection(option.id)"
        >
          <div class="min-w-0 flex-1">
            <div class="focus:outline-none">
              <p class="flex items-center gap-2 text-sm text-gray-900 font-medium dark:text-gray-100">
                {{ option.title }}
                <TransitionGroup name="fade">
                  <span v-if="isSelected(option.id)" :key="`check${option.id}`" class="text-blue-500 dark:text-blue-400">
                    <div class="i-lucide-circle-check h-4 w-4" />
                  </span>
                </TransitionGroup>
              </p>
              <p v-if="option.subtitle" class="truncate text-sm text-gray-500 dark:text-gray-400">
                {{ option.subtitle }}
              </p>
            </div>
          </div>
        </button>
      </TransitionGroup>

      <!-- Pagination -->
      <Pagination
        v-if="totalPages > 1"
        v-model="currentPage"
        :total="totalPages"
        theme="blue"
      />

      <!-- No Results Message -->
      <div v-if="filteredOptions.length === 0" class="py-8 text-center text-gray-500 dark:text-gray-400">
        {{ t('pages.index.not_chats_found') }}
      </div>
    </div>

    <!-- Priority Settings Dialog -->
    <Teleport to=".dialog-wrapper">
      <Dialog v-model="showPriorityDialog">
        <div class="space-y-4">
          <div class="flex items-center justify-between border-b border-gray-200 pb-4 dark:border-gray-700">
            <h3 class="text-lg font-medium dark:text-gray-100">
              {{ t('component.sync_command.set_priorities') }}
            </h3>
            <button
              class="text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400"
              @click="showPriorityDialog = false"
            >
              <div class="i-lucide-close h-5 w-5" />
            </button>
          </div>

          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('component.sync_command.priority_tip') }}
          </p>

          <div class="max-h-[60vh] overflow-y-auto space-y-3">
            <div
              v-for="chatId in selectedChats"
              :key="chatId"
              class="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50"
            >
              <span class="dark:text-gray-200">{{ getChatTitle(chatId) }}</span>
              <input
                v-model="priorities[chatId]"
                type="number"
                min="0"
                max="100"
                class="w-24 border-gray-300 rounded-md dark:border-gray-600 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 focus:ring-blue-500"
              >
            </div>
          </div>

          <div class="flex justify-end border-t border-gray-200 pt-4 space-x-3 dark:border-gray-700">
            <button
              class="border border-gray-300 rounded-md bg-white px-4 py-2 text-sm text-gray-700 font-medium shadow-sm dark:border-gray-600 dark:bg-gray-800 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
              @click="showPriorityDialog = false"
            >
              {{ t('pages.settings.cancel') }}
            </button>
            <button
              class="border border-transparent rounded-md bg-blue-500 px-4 py-2 text-sm text-white font-medium shadow-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              @click="confirmPriorities"
            >
              {{ t('pages.settings.confirm') }}
            </button>
          </div>
        </div>
      </Dialog>
    </Teleport>

    <!-- Sync Status -->
    <div v-if="currentCommand" class="overflow-hidden rounded-lg bg-white shadow-md transition-all duration-300 dark:bg-gray-800 dark:text-gray-100">
      <div class="p-5">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="flex items-center text-lg font-semibold">
            <span class="mr-2">{{ t('component.sync_command.sync_status') }}</span>
            <span
              v-if="currentCommand.status === 'running'"
              class="inline-block animate-spin text-yellow-500"
            >
              <Icon :icon="statusIcon" />
            </span>
          </h2>
          <StatusBadge
            :status="commandStatus"
            :label="statusText"
            :icon="statusIcon"
          />
        </div>

        <!-- Progress bar -->
        <div class="mb-5">
          <ProgressBar
            :progress="commandProgress"
            :status="commandStatus"
          />
        </div>

        <!-- 等待提示 -->
        <div v-if="isWaiting" class="animate-fadeIn mb-5 rounded-md bg-yellow-50 p-3 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
          <p class="flex items-center">
            <span class="mr-2 text-lg">⏱</span>
            <span>{{ t('component.sync_command.telegram_limit', { waitingTimeLeft }) }}</span>
          </p>
        </div>

        <!-- Status message -->
        <div v-if="currentCommand.message" class="mb-4 text-sm text-gray-700 dark:text-gray-300">
          <p class="mb-1 font-medium">
            {{ t('component.sync_command.current_state') }}
          </p>
          <p>{{ currentCommand.message }}</p>
        </div>

        <!-- Sync details -->
        <div v-if="currentCommand.metadata" class="mt-6 space-y-4">
          <h3 class="text-gray-800 font-medium dark:text-gray-200">
            {{ t('component.sync_command.sync_detail') }}
          </h3>

          <div class="rounded-md bg-gray-50 p-4 dark:bg-gray-700/50">
            <div class="text-sm space-y-3">
              <div v-if="currentCommand.metadata?.totalChats" class="flex items-center justify-between">
                <span class="text-gray-600 dark:text-gray-300">{{ t('component.sync_command.total_chats') }}</span>
                <span class="font-medium">{{ formatNumberToReadable(Number(currentCommand.metadata.totalChats)) }}</span>
              </div>

              <div v-if="currentCommand.metadata?.processedChats" class="flex items-center justify-between">
                <span class="text-gray-600 dark:text-gray-300">{{ t('component.sync_command.processed_chats') }}</span>
                <span class="flex items-center font-medium">
                  {{ formatNumberToReadable(Number(currentCommand.metadata.processedChats)) }}
                  <template v-if="currentCommand.metadata?.totalChats">
                    <span class="mx-1">/</span> {{ formatNumberToReadable(Number(currentCommand.metadata.totalChats)) }}
                  </template>
                </span>
              </div>

              <div v-if="currentCommand.metadata?.failedChats" class="flex items-center justify-between text-red-600 dark:text-red-400">
                <span>{{ t('component.sync_command.failed_chats') }}</span>
                <span class="font-medium">{{ formatNumberToReadable(Number(currentCommand.metadata.failedChats)) }}</span>
              </div>
            </div>
          </div>

          <!-- Error message -->
          <div v-if="currentCommand.error" class="animate-fadeIn mt-4 rounded-md bg-red-50 p-4 text-red-700 dark:bg-red-900/50 dark:text-red-100">
            <p class="mb-2 font-medium">
              {{ t('component.sync_command.error_message') }}
            </p>
            <div v-if="typeof currentCommand.error === 'string'" class="text-sm">
              {{ currentCommand.error }}
            </div>
            <div v-else class="text-sm">
              <div>{{ currentCommand.error.name }}: {{ currentCommand.error.message }}</div>
              <pre v-if="currentCommand.error.stack" class="mt-3 overflow-auto rounded-md bg-red-100 p-2 text-xs dark:bg-red-900/50">{{ currentCommand.error.stack }}</pre>
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
            <span>{{ t('component.sync_command.sync_success') }}</span>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.grid-item {
  transition: all 0.3s ease-in-out;
}

.grid-item.selected {
  transform: scale(1.02);
}

/* Grid list animations */
.grid-list-move,
.grid-list-enter-active,
.grid-list-leave-active {
  transition: all 0.3s ease;
}

.grid-list-enter-from,
.grid-list-leave-to {
  opacity: 0;
  transform: translateY(30px);
}

.grid-list-leave-active {
  position: absolute;
}

/* Checkmark animations */
.fade-enter-active,
.fade-leave-active {
  transition: all 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

/* Hover effects */
.grid-item:hover:not(.selected) {
  transform: translateY(-2px);
}

.grid-item:active {
  transform: scale(0.98);
}

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
