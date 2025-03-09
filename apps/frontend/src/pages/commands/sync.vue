<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { useSyncChats } from '../../apis/commands/useSyncChats'
import { useSyncMetadata } from '../../apis/commands/useSyncMetadata'
import { useChats } from '../../apis/useChats'
import NeedLogin from '../../components/NeedLogin.vue'
import ChatSelector from '../../components/sync/ChatSelector.vue'
import SyncStatus from '../../components/sync/SyncStatus.vue'
import { useSession } from '../../composables/useSession'

const { t } = useI18n()
const { chats, loadChats } = useChats()
const { executeChatsSync, currentCommand: chatsSyncCommand, syncProgress: chatsSyncProgress } = useSyncChats()
const { executeMetadataSync, currentCommand: metadataSyncCommand, syncProgress: metadataSyncProgress } = useSyncMetadata()
const { checkConnection, isConnected } = useSession()

const selectedChats = ref<number[]>([])
const priorities = ref<Record<number, number>>({})
const showPriorityDialog = ref(false)
const showConnectButton = ref(false)
const waitingTimeLeft = ref(0)

const currentCommand = computed(() => chatsSyncCommand.value || metadataSyncCommand.value)
const commandProgress = computed(() => chatsSyncProgress.value || metadataSyncProgress.value || 0)

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

  try {
    const result = await executeChatsSync({
      chatIds: selectedChats.value,
      priorities: priorities.value,
    })
    if (result.success) {
      toast.success(t('component.sync_command.sync_success'), { id: toastId })
    }
    else {
      const errorMessage = String(result.error || t('component.sync_command.sync_error'))
      toast.error(errorMessage, { id: toastId })
    }
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    toast.error(t('component.sync_command.sync_failure', { error: errorMessage }), { id: toastId })
    console.error('Failed to start sync:', error)
  }
}

async function syncMetadata() {
  if (!isConnected.value) {
    toast.error(t('component.sync_command.not_connect'))
    return
  }

  const toastId = toast.loading(t('component.sync_command.prepare_sync_'))

  try {
    const result = await executeMetadataSync({})
    if (!result.success) {
      const errorMessage = String(result.error || t('component.sync_command.sync_error'))
      toast.error(errorMessage, { id: toastId })
    }
    else {
      toast.success(t('component.sync_command.sync_success'), { id: toastId })
    }
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    toast.error(t('component.sync_command.sync_failure', { error: errorMessage }), { id: toastId })
  }
}

// Watchers
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
          {{ t('component.sync_command.selected_count', { count: selectedChats.length }) }}
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
          {{ t('component.sync_command.start_sync') }}
        </button>
      </div>
    </div>

    <ChatSelector
      v-model:selected-chats="selectedChats"
      :chats="chats"
    />

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
    <SyncStatus
      :command="currentCommand"
      :progress="commandProgress"
      :waiting-time-left="waitingTimeLeft"
    />
  </div>
</template>
