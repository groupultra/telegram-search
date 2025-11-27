<script setup lang="ts">
import type { SyncOptions } from '@tg-search/core'

import NProgress from 'nprogress'

import { getErrorMessage, useAuthStore, useBridgeStore, useChatStore, useSyncTaskStore } from '@tg-search/client'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import ChatSelector from '../components/ChatSelector.vue'
import SyncOptionsComponent from '../components/SyncOptions.vue'
import SyncVisualization from '../components/SyncVisualization.vue'
import Dialog from '../components/ui/Dialog.vue'

import { Button } from '../components/ui/Button'
import { Progress } from '../components/ui/Progress'

const { t } = useI18n()
const router = useRouter()

const selectedChats = ref<number[]>([])
const syncOptions = ref<SyncOptions>({
  syncMedia: true,
  maxMediaSize: 0,
})

const sessionStore = useAuthStore()
const { isLoggedIn } = storeToRefs(sessionStore)
const websocketStore = useBridgeStore()

const chatsStore = useChatStore()
const { chats } = storeToRefs(chatsStore)

const syncTaskStore = useSyncTaskStore()
const { currentTask, currentTaskProgress, increase, chatStats, chatStatsLoading } = storeToRefs(syncTaskStore)

// Currently focused chat id for status panel; independent from multi-selection
const activeChatId = ref<number | null>(null)

// Sync options dialog state
const isSyncOptionsDialogOpen = ref(false)

const activeChat = computed(() => {
  if (!activeChatId.value)
    return undefined
  return chats.value.find(chat => chat.id === activeChatId.value)
})

// Default to incremental sync
if (increase.value === undefined || increase.value === null) {
  increase.value = true
}

// Task in progress status
const isTaskInProgress = computed(() => {
  return !!currentTask.value && currentTaskProgress.value >= 0 && currentTaskProgress.value < 100
})

// Get i18n error message from raw error
const errorMessage = computed(() => {
  const task = currentTask.value
  if (!task?.rawError)
    return task?.lastError
  return getErrorMessage(task.rawError, (key, params) => t(key, params || {}))
})

// Check if task was cancelled (not an error)
const isTaskCancelled = computed(() => {
  const task = currentTask.value
  return task?.lastError === 'Task aborted'
})

// Show task status area (includes in-progress and error states, but not cancelled)
const shouldShowTaskStatus = computed(() => {
  return !!currentTask.value && (isTaskInProgress.value || (currentTask.value.lastError && !isTaskCancelled.value))
})

// Disable buttons during sync or when no chats selected
const isButtonDisabled = computed(() => {
  return selectedChats.value.length === 0 || !isLoggedIn.value || isTaskInProgress.value
})

/**
 * Compute disabled state for the "Select All" button.
 * Disabled when: not logged in, a task is in progress, or no chats.
 */
const isSelectAllDisabled = computed(() => {
  return !isLoggedIn.value || isTaskInProgress.value || chats.value.length === 0
})

/**
 * Performance optimized check for whether all chats are selected.
 * Uses Set for O(1) lookup instead of O(N^2) with array.includes() for each chat.
 * Returns true when selectedChats covers all chat IDs.
 */
/**
 * Performance optimized computed property for all chat IDs.
 * Follows DRY (Don't Repeat Yourself) principle by centralizing the mapping logic.
 */
const allChatIds = computed(() => chats.value.map(c => c.id))

const isAllSelected = computed(() => {
  const allIds = allChatIds.value
  if (allIds.length === 0 || selectedChats.value.length !== allIds.length) {
    return false
  }

  // Use Set for efficient lookup to avoid O(N^2) complexity
  const selectedSet = new Set(selectedChats.value)
  return allIds.every(id => selectedSet.has(id))
})

/**
 * Threshold for showing a warning toast when selecting all chats.
 * When the number of chats exceeds this value, a warning toast is shown.
 */
const SELECT_ALL_WARNING_THRESHOLD = 50

/**
 * Dialog state for "Select All" reminder.
 * - isSelectAllDialogOpen: controls dialog visibility
 * - selectAllCount: holds current total chats count for i18n message
 * - isSelectAllWarning: whether to show warning style (count >= threshold)
 */
const isSelectAllDialogOpen = ref(false)
const selectAllCount = ref<number>(0)
const isSelectAllWarning = ref<boolean>(false)

/**
 * Handle "Select All" click with toggle behavior.
 * If all chats are selected, clear selection; otherwise select all.
 * When selecting all, open a dialog to remind that syncing many chats
 * may take a long time.
 */
function handleSelectAll() {
  const allIds = allChatIds.value
  const allSelected = isAllSelected.value

  selectedChats.value = allSelected ? [] : allIds

  // Show prompt only when switching to "Select All"
  if (!allSelected) {
    const count = allIds.length
    selectAllCount.value = count
    isSelectAllWarning.value = count >= SELECT_ALL_WARNING_THRESHOLD
    isSelectAllDialogOpen.value = true
  }
}

/**
 * Localize takeout task progress message.
 * Converts backend English `lastMessage` to i18n-friendly text.
 * Parses "Processed X/Y messages" and maps known status strings.
 */
const localizedTaskMessage = computed(() => {
  const msg = currentTask.value?.lastMessage || ''
  if (!msg)
    return ''

  // Parse progress message: "Processed 123/456 messages"
  const processedMatch = msg.match(/^Processed\s+(\d+)\/(\d+)\s+messages$/i)
  if (processedMatch) {
    const processed = Number(processedMatch[1])
    const total = Number(processedMatch[2])
    return t('sync.processedMessages', { processed, total })
  }

  // Map known status messages
  switch (msg) {
    case 'Init takeout session':
      return t('sync.initTakeoutSession')
    case 'Get messages':
      return t('sync.getMessages')
    case 'Starting incremental sync':
      return t('sync.startingIncrementalSync')
    case 'Incremental sync completed':
      return t('sync.incrementalSyncCompleted')
    default:
      // Return original text for unknown messages to avoid information loss
      return msg
  }
})

function handleSync() {
  increase.value = true
  websocketStore.sendEvent('takeout:run', {
    chatIds: selectedChats.value.map(id => id.toString()),
    increase: true,
    syncOptions: syncOptions.value,
  })

  NProgress.start()
}

function handleResync() {
  increase.value = false
  websocketStore.sendEvent('takeout:run', {
    chatIds: selectedChats.value.map(id => id.toString()),
    increase: false,
    syncOptions: syncOptions.value,
  })

  NProgress.start()
}

function handleAbort() {
  if (currentTask.value) {
    websocketStore.sendEvent('takeout:task:abort', {
      taskId: currentTask.value.taskId,
    })
  }
  else {
    toast.error(t('sync.noInProgressTask'))
  }
}

watch(currentTaskProgress, (progress) => {
  if (progress === 100) {
    toast.success(t('sync.syncCompleted'))
    NProgress.done()
    increase.value = true
  }
  else if (progress < 0 && currentTask.value?.lastError) {
    // Check if task was cancelled
    if (isTaskCancelled.value) {
      // Task was cancelled, just clear the task and stop progress
      NProgress.done()
      currentTask.value = undefined
    }
    else {
      // Real error - progress bar UI will show it
      NProgress.done()
    }
  }
  else if (progress >= 0 && progress < 100) {
    NProgress.set(progress / 100)
  }
})

// Fetch stats when active chat changes
watch(activeChatId, (chatId) => {
  if (!chatId) {
    chatStats.value = undefined
    chatStatsLoading.value = false
    return
  }

  chatStatsLoading.value = true
  websocketStore.sendEvent('takeout:stats:fetch', {
    chatId: chatId.toString(),
  })
})
</script>

<template>
  <div class="h-full flex flex-col bg-background">
    <header class="flex items-center justify-between border-b bg-card/50 px-6 py-4 backdrop-blur-sm">
      <div class="flex items-center gap-3">
        <h1 class="text-lg font-semibold">
          {{ t('sync.sync') }}
        </h1>
      </div>

      <div class="flex items-center gap-2">
        <Button
          icon="i-lucide-refresh-cw"
          variant="ghost"
          size="sm"
          :disabled="isButtonDisabled"
          @click="handleSync"
        >
          {{ t('sync.incrementalSync') }}
        </Button>
        <Button
          icon="i-lucide-rotate-ccw"
          variant="outline"
          size="sm"
          :disabled="isButtonDisabled"
          @click="handleResync"
        >
          {{ t('sync.resync') }}
        </Button>
        <Button
          icon="i-lucide-sliders-horizontal"
          variant="outline"
          size="sm"
          @click="isSyncOptionsDialogOpen = true"
        >
          {{ t('sync.syncOptions') }}
        </Button>
      </div>
    </header>

    <!-- Login prompt banner -->
    <div
      v-if="!isLoggedIn"
      class="flex items-center justify-center px-6 py-8"
    >
      <div
        class="max-w-2xl w-full border border-primary/20 rounded-2xl bg-primary/5 p-6 transition-all"
      >
        <div class="flex flex-col items-center justify-center gap-4 md:flex-row md:justify-between">
          <div class="flex items-center gap-4">
            <div class="h-12 w-12 flex shrink-0 items-center justify-center rounded-full bg-primary/10">
              <div class="i-lucide-lock-keyhole h-6 w-6 text-primary" />
            </div>
            <div class="flex flex-col gap-1">
              <span class="text-sm text-foreground font-semibold">{{ t('loginPromptBanner.pleaseLoginToUseFullFeatures') }}</span>
              <span class="text-xs text-muted-foreground">{{ t('loginPromptBanner.subtitle') }}</span>
            </div>
          </div>
          <Button
            size="md"
            icon="i-lucide-log-in"
            class="shrink-0"
            @click="router.push({ path: '/login', query: { redirect: '/sync' } })"
          >
            {{ t('loginPromptBanner.login') }}
          </Button>
        </div>
      </div>
    </div>

    <div v-else class="flex flex-1 flex-col overflow-hidden p-6">
      <div class="mx-auto h-full max-w-6xl w-full flex flex-col space-y-6">
        <!-- Combined card: sync task status + per-chat visualization -->
        <div
          class="flex flex-1 flex-col border rounded-2xl bg-card p-6 shadow-sm transition-all"
          :class="shouldShowTaskStatus
            ? (currentTask?.lastError ? 'border-destructive/20 bg-destructive/5' : 'border-primary/20 bg-primary/5')
            : 'border-border'"
        >
          <div
            v-if="shouldShowTaskStatus"
            class="mb-6 border-b border-border/60 pb-6 space-y-4"
          >
            <div class="flex items-center gap-4">
              <div
                class="h-12 w-12 flex shrink-0 items-center justify-center rounded-full"
                :class="currentTask?.lastError ? 'bg-destructive/10' : 'bg-primary/10'"
              >
                <div v-if="currentTask?.lastError" class="i-lucide-alert-circle h-6 w-6 text-destructive" />
                <div v-else class="i-lucide-loader-2 h-6 w-6 animate-spin text-primary" />
              </div>
              <div class="flex flex-1 flex-col gap-1">
                <span class="text-base text-foreground font-semibold">
                  {{ currentTask?.lastError ? t('sync.syncFailed') : t('sync.syncing') }}
                </span>
                <span v-if="currentTask?.lastError" class="text-sm text-destructive">{{ errorMessage }}</span>
                <span v-else-if="localizedTaskMessage" class="text-sm text-muted-foreground">{{ localizedTaskMessage }}</span>
              </div>
            </div>

            <Progress
              v-if="!currentTask?.lastError"
              :progress="currentTaskProgress"
            />

            <div class="flex justify-end gap-2">
              <Button
                v-if="currentTask?.lastError"
                icon="i-lucide-x"
                size="sm"
                variant="outline"
                @click="syncTaskStore.currentTask = undefined"
              >
                {{ t('sync.dismiss') }}
              </Button>
              <Button
                v-else
                icon="i-lucide-x"
                size="sm"
                variant="outline"
                @click="handleAbort"
              >
                {{ t('sync.cancel') }}
              </Button>
            </div>
          </div>

          <!-- Main content: chat list + status stacked -->
          <div class="min-h-0 flex flex-1 flex-col space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-lg text-foreground font-semibold">
                  {{ t('sync.selectChats') }}
                </h3>
                <p class="mt-1 text-sm text-muted-foreground">
                  {{ t('sync.syncPrompt') }}
                </p>
              </div>

              <div class="flex items-center gap-3">
                <div class="flex items-center gap-2 rounded-full bg-muted px-4 py-2">
                  <span class="i-lucide-check-circle h-4 w-4 text-primary" />
                  <span class="text-sm text-foreground font-medium">
                    {{ t('sync.selectedChats', { count: selectedChats.length }) }}
                  </span>
                </div>
                <button
                  class="flex appearance-none items-center gap-2 rounded-full bg-muted px-4 py-2"
                  :disabled="isSelectAllDisabled"
                  :class="{ 'opacity-50 cursor-not-allowed': isSelectAllDisabled }"
                  @click="handleSelectAll"
                >
                  <span class="i-lucide-check-square h-4 w-4 text-primary" />
                  <span class="text-sm text-foreground font-medium">{{ isAllSelected ? t('sync.deselectAll') : t('sync.selectAll') }}</span>
                </button>
              </div>
            </div>

            <div class="min-h-0 flex-1 overflow-hidden">
              <ChatSelector
                v-model:selected-chats="selectedChats"
                v-model:active-chat-id="activeChatId"
                :chats="chats"
              />
            </div>

            <!-- Status panel under the list, inside the same card -->
            <SyncVisualization
              :stats="chatStats"
              :loading="chatStatsLoading"
              :chat-label="activeChat ? (activeChat.name || t('chatSelector.chat', { id: activeChat.id })) : ''"
            />
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Sync Options Dialog -->
  <Dialog v-model="isSyncOptionsDialogOpen" max-width="40rem">
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-base text-foreground font-semibold">
          {{ t('sync.syncOptions') }}
        </h3>
        <Button
          icon="i-lucide-x"
          size="sm"
          variant="outline"
          @click="isSyncOptionsDialogOpen = false"
        >
          {{ t('sync.dismiss') }}
        </Button>
      </div>

      <SyncOptionsComponent v-model="syncOptions" />
    </div>
  </Dialog>

  <!-- Select All Reminder Dialog -->
  <Dialog v-model="isSelectAllDialogOpen" max-width="32rem" persistent>
    <div class="space-y-5">
      <div class="flex items-start gap-4">
        <div
          class="h-12 w-12 flex items-center justify-center rounded-xl ring-1"
          :class="isSelectAllWarning ? 'bg-destructive/10 ring-destructive/30' : 'bg-primary/10 ring-primary/30'"
        >
          <span
            :class="isSelectAllWarning ? 'i-lucide-alert-triangle text-destructive' : 'i-lucide-info text-primary'"
            class="h-6 w-6"
          />
        </div>
        <div class="flex-1">
          <p class="text-base text-foreground font-medium leading-relaxed">
            {{ isSelectAllWarning
              ? t('sync.selectAllWarning', { count: selectAllCount })
              : t('sync.selectAllInfo', { count: selectAllCount })
            }}
          </p>
        </div>
      </div>

      <div class="flex justify-end gap-2">
        <Button
          icon="i-lucide-x"
          size="sm"
          variant="outline"
          @click="isSelectAllDialogOpen = false"
        >
          {{ t('sync.dismiss') }}
        </Button>
      </div>
    </div>
  </Dialog>
</template>
