<script setup lang="ts">
import type { SyncOptions } from '@tg-search/core'
import type { DateRange, DateValue } from 'reka-ui'

import NProgress from 'nprogress'

import { useAccountStore, useBridge, useChatStore, useSyncTaskStore } from '@tg-search/client'
import { CoreEventType } from '@tg-search/core'
import { useMediaQuery } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import {
  DateRangePickerCalendar,
  DateRangePickerCell,
  DateRangePickerCellTrigger,
  DateRangePickerContent,
  DateRangePickerGrid,
  DateRangePickerGridBody,
  DateRangePickerGridHead,
  DateRangePickerGridRow,
  DateRangePickerHeading,
  DateRangePickerNext,
  DateRangePickerPrev,
  DateRangePickerRoot,
  DateRangePickerTrigger,
} from 'reka-ui'
import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import ChatSelector from '../components/ChatSelector.vue'
import MobileSyncStatsDrawer from '../components/MobileSyncStatsDrawer.vue'
import SyncSelectedSummaryPanel from '../components/SyncSelectedSummaryPanel.vue'
import SyncVisualization from '../components/SyncVisualization.vue'

import { Button } from '../components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/Dialog'
import { Input } from '../components/ui/Input'
import { Switch } from '../components/ui/Switch'
import {
  areAllVisibleChatsSelected,
  toggleVisibleChatSelection,
} from '../utils/chat-selection-scope'
import {
  formatRangeLabel,
  sameRange,
  toDateRange,
  toTimestampMs,
} from '../utils/date-range'

const { t } = useI18n()

const selectedChats = ref<number[]>([])
const visibleChatIds = ref<number[]>([])
const accountStore = useAccountStore()
const { accountSettings } = storeToRefs(accountStore)

function buildDefaultSyncOptions(): SyncOptions {
  const defaults = accountSettings.value.messageProcessing?.defaults
  const syncMedia = defaults?.syncMedia ?? true
  return {
    syncMedia,
    maxMediaSize: defaults?.maxMediaSize ?? 0,
    skipEmbedding: defaults?.skipEmbedding,
    skipJieba: defaults?.skipJieba,
  }
}

const syncOptions = ref<SyncOptions>(buildDefaultSyncOptions())

const syncMedia = ref(syncOptions.value.syncMedia ?? true)
const maxMediaSize = ref(syncOptions.value.maxMediaSize ?? 0)
const minMessageId = ref(syncOptions.value.minMessageId ?? undefined)
const maxMessageId = ref(syncOptions.value.maxMessageId ?? undefined)
const timeRange = shallowRef<DateRange>(toDateRange(syncOptions.value.startTime, syncOptions.value.endTime))

const formattedRangeLabel = computed(() => formatRangeLabel(timeRange.value))

function applySyncOptionsToLocalState(options: SyncOptions) {
  syncMedia.value = options.syncMedia ?? true
  maxMediaSize.value = options.maxMediaSize ?? 0
  minMessageId.value = options.minMessageId ?? undefined
  maxMessageId.value = options.maxMessageId ?? undefined
  timeRange.value = toDateRange(options.startTime, options.endTime)
}

const bridge = useBridge()

const chatsStore = useChatStore()
const { chats, folders } = storeToRefs(chatsStore)

const syncTaskStore = useSyncTaskStore()
const {
  currentTask,
  currentTaskProgress,
  increase,
  chatStats,
  chatStatsByChatId,
  chatStatsFocusedChatId,
  chatStatsLoading,
  takeoutConfirmNeeded,
} = storeToRefs(syncTaskStore)

// Currently focused chat id for status panel; independent from multi-selection
const activeChatId = ref<number | null>(null)
// Chat IDs captured when a sync run starts; used for aggregate progress.
const runChatIds = ref<number[]>([])
// Accumulated processed messages from completed chats in the current run.
const runCompletedMessages = ref(0)

// Sync options dialog state
const isSyncOptionsDialogOpen = ref(false)
const isDesktop = useMediaQuery('(min-width: 768px)')
const isBottomPanelOpen = ref(isDesktop.value)

watch(
  () => [syncOptions.value.startTime, syncOptions.value.endTime] as const,
  ([start, end]) => {
    const nextRange = toDateRange(start, end)
    if (!sameRange(nextRange, timeRange.value)) {
      timeRange.value = nextRange
    }
  },
)

watch([syncMedia, maxMediaSize, timeRange, minMessageId, maxMessageId], () => {
  syncOptions.value = {
    ...syncOptions.value,
    syncMedia: syncMedia.value,
    maxMediaSize: maxMediaSize.value,
    startTime: toTimestampMs(timeRange.value.start),
    endTime: toTimestampMs(timeRange.value.end),
    minMessageId: minMessageId.value,
    maxMessageId: maxMessageId.value,
  }
})

watch(isSyncOptionsDialogOpen, (open) => {
  if (open) {
    applySyncOptionsToLocalState(syncOptions.value)
  }
})

watch(
  () => accountSettings.value.messageProcessing?.defaults,
  (nextOptions) => {
    if (isSyncOptionsDialogOpen.value) {
      return
    }
    const syncMedia = nextOptions?.syncMedia ?? true
    syncOptions.value = {
      ...syncOptions.value,
      syncMedia,
      maxMediaSize: nextOptions?.maxMediaSize ?? 0,
      skipEmbedding: nextOptions?.skipEmbedding,
      skipJieba: nextOptions?.skipJieba,
    }
    applySyncOptionsToLocalState(syncOptions.value)
  },
)

const currentSyncingChatId = computed(() => {
  const rawChatId = currentTask.value?.metadata?.chatIds?.[0]
  const parsed = Number(rawChatId)
  return Number.isFinite(parsed) ? parsed : null
})

// Default to incremental sync
if (increase.value === undefined || increase.value === null) {
  increase.value = true
}

// Automatically switch active visualization to the currently syncing chat
watch(currentTask, (task, previousTask) => {
  // Roll up completed scope from the previous task into this run's aggregate stats.
  if (previousTask && task && previousTask.taskId !== task.taskId && previousTask.progress >= 100) {
    const completedChatId = Number(previousTask.metadata.chatIds[0])
    const fallbackTotal = chats.value.find(chat => chat.id === completedChatId)?.messageCount ?? 0
    runCompletedMessages.value += previousTask.metadata.totalMessages ?? fallbackTotal
  }

  if (task && task.metadata?.chatIds?.length === 1) {
    const syncingChatId = Number(task.metadata.chatIds[0])
    if (activeChatId.value !== syncingChatId) {
      activeChatId.value = syncingChatId
    }
  }
})

// Task in progress status
const isTaskInProgress = computed(() => {
  return !!currentTask.value && currentTaskProgress.value >= 0 && currentTaskProgress.value < 100
})

// Auto-focus one selected chat for right-side visualization before sync starts.
watch(
  selectedChats,
  (chatIds) => {
    if (isTaskInProgress.value) {
      return
    }

    if (chatIds.length === 0) {
      activeChatId.value = null
      return
    }

    if (activeChatId.value != null && chatIds.includes(activeChatId.value)) {
      return
    }

    activeChatId.value = chatIds[chatIds.length - 1] ?? null
  },
  { immediate: true },
)

const visualizationChatId = computed(() => {
  if (isTaskInProgress.value && currentSyncingChatId.value) {
    return currentSyncingChatId.value
  }
  return activeChatId.value
})

const visualizationChat = computed(() => {
  if (!visualizationChatId.value)
    return undefined
  return chats.value.find(chat => chat.id === visualizationChatId.value)
})

// Check if task was cancelled (not an error)
const isTaskCancelled = computed(() => {
  const task = currentTask.value
  return task?.lastError === 'Task aborted'
})

// Show task status area (includes in-progress and error states, but not cancelled)
const shouldShowTaskStatus = computed(() => {
  return !!currentTask.value && (isTaskInProgress.value || (!!currentTask.value.lastError && !isTaskCancelled.value))
})

// Disable buttons during sync or when no chats selected
const isButtonDisabled = computed(() => {
  return selectedChats.value.length === 0 || isTaskInProgress.value
})

const syncScopeChatIds = computed(() => {
  if (shouldShowTaskStatus.value && runChatIds.value.length > 0) {
    return runChatIds.value
  }
  return selectedChats.value
})

const selectedTotalMessages = computed(() => {
  if (syncScopeChatIds.value.length === 0) {
    return 0
  }

  const chatMap = new Map(chats.value.map(chat => [chat.id, chat]))
  return syncScopeChatIds.value.reduce((sum, chatId) => {
    const chat = chatMap.get(chatId)
    const fromStats = chatStatsByChatId.value[String(chatId)]?.totalMessages ?? 0
    if (fromStats > 0) {
      return sum + fromStats
    }

    const fromDialog = chat?.messageCount ?? 0
    return sum + fromDialog
  }, 0)
})

const currentTaskScopeTotalMessages = computed(() => {
  const task = currentTask.value
  if (!task) {
    return 0
  }

  if (typeof task.metadata.totalMessages === 'number' && task.metadata.totalMessages > 0) {
    return task.metadata.totalMessages
  }

  const chatId = Number(task.metadata.chatIds[0])
  const fromStats = chatStatsByChatId.value[String(chatId)]?.totalMessages ?? 0
  if (fromStats > 0) {
    return fromStats
  }

  const chat = chats.value.find(c => c.id === chatId)
  return chat?.messageCount ?? 0
})

const aggregateProcessedMessages = computed(() => {
  const total = selectedTotalMessages.value
  if (total <= 0) {
    return 0
  }

  const currentProcessed = Math.round((Math.max(0, Math.min(100, currentTaskProgress.value)) / 100) * currentTaskScopeTotalMessages.value)
  return Math.min(total, runCompletedMessages.value + currentProcessed)
})

const aggregateProgress = computed(() => {
  const total = selectedTotalMessages.value
  if (total <= 0) {
    return Math.max(0, Math.min(100, Math.round(currentTaskProgress.value || 0)))
  }
  return Math.max(0, Math.min(100, Math.round((aggregateProcessedMessages.value / total) * 100)))
})

/**
 * Compute disabled state for the "Select All" button.
 * Disabled when a task is in progress or the current scope has no chats.
 */
const isSelectAllDisabled = computed(() => {
  return isTaskInProgress.value || visibleChatIds.value.length === 0
})

/**
 * Treat "all selected" as all chats in the current filtered scope being selected.
 */
const isAllSelected = computed(() => {
  return areAllVisibleChatsSelected(selectedChats.value, visibleChatIds.value)
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
  const allSelected = isAllSelected.value
  const nextSelectedChats = toggleVisibleChatSelection(selectedChats.value, visibleChatIds.value)

  selectedChats.value = nextSelectedChats

  // Show prompt only when switching to "Select All"
  if (!allSelected) {
    const count = nextSelectedChats.length
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
const selectedSyncedMessages = computed(() => {
  if (selectedChats.value.length === 0) {
    return 0
  }

  return selectedChats.value.reduce((sum, chatId) => {
    return sum + (chatStatsByChatId.value[String(chatId)]?.syncedMessages ?? 0)
  }, 0)
})

const selectionPreviewProgress = computed(() => {
  if (selectedTotalMessages.value <= 0) {
    return 0
  }
  return Math.max(0, Math.min(100, Math.round((selectedSyncedMessages.value / selectedTotalMessages.value) * 100)))
})

const shouldShowSelectionSummary = computed(() => {
  return !shouldShowTaskStatus.value && selectedChats.value.length > 1
})

const summarySelectedCount = computed(() => {
  if (shouldShowTaskStatus.value && runChatIds.value.length > 0) {
    return runChatIds.value.length
  }
  return selectedChats.value.length
})

const summarySelectionTitle = computed(() => {
  return t('sync.selectedChats', { count: summarySelectedCount.value })
})

const summaryProgress = computed(() => {
  return Math.max(0, Math.min(100, Math.round(shouldShowTaskStatus.value ? aggregateProgress.value : selectionPreviewProgress.value)))
})

const summaryHasError = computed(() => {
  return shouldShowTaskStatus.value && !!currentTask.value?.lastError
})

const summaryTotalCount = computed(() => {
  return Math.max(0, selectedTotalMessages.value)
})

const summarySyncedCount = computed(() => {
  const value = shouldShowTaskStatus.value ? aggregateProcessedMessages.value : selectedSyncedMessages.value
  return Math.max(0, Math.min(summaryTotalCount.value, value))
})

const summaryUnsyncedCount = computed(() => {
  return Math.max(0, summaryTotalCount.value - summarySyncedCount.value)
})

const currentChatTotalCount = computed(() => {
  return Math.max(0, chatStats.value?.totalMessages ?? 0)
})

const currentChatSyncedCount = computed(() => {
  if (!chatStats.value) {
    return 0
  }
  return Math.max(0, Math.min(chatStats.value.syncedMessages, chatStats.value.totalMessages))
})

const currentChatUnsyncedCount = computed(() => {
  return Math.max(0, currentChatTotalCount.value - currentChatSyncedCount.value)
})

const currentChatProgress = computed(() => {
  if (currentChatTotalCount.value <= 0) {
    return 0
  }
  return Math.max(0, Math.min(100, Math.round((currentChatSyncedCount.value / currentChatTotalCount.value) * 100)))
})

const hasSelectedStatusPanel = computed(() => {
  return shouldShowTaskStatus.value || shouldShowSelectionSummary.value
})

const hasCurrentStatusPanel = computed(() => {
  return !!visualizationChat.value
})

const hasMobileStatusContent = computed(() => {
  return hasSelectedStatusPanel.value || hasCurrentStatusPanel.value
})

const mobileStatusTab = ref<'selected' | 'current'>('selected')
const isMobileStatusOpen = ref(false)

watch([hasSelectedStatusPanel, hasCurrentStatusPanel, isTaskInProgress], ([hasSelected, hasCurrent, syncing]) => {
  if (syncing && hasCurrent) {
    mobileStatusTab.value = 'current'
    return
  }

  if (mobileStatusTab.value === 'selected' && !hasSelected && hasCurrent) {
    mobileStatusTab.value = 'current'
  }
  else if (mobileStatusTab.value === 'current' && !hasCurrent && hasSelected) {
    mobileStatusTab.value = 'selected'
  }
})

watch([isDesktop, hasMobileStatusContent, isTaskInProgress], ([desktop, hasContent, syncing]) => {
  if (desktop) {
    isMobileStatusOpen.value = false
    isBottomPanelOpen.value = true
    return
  }

  if (!hasContent) {
    isMobileStatusOpen.value = false
    return
  }

  if (syncing) {
    isMobileStatusOpen.value = true
  }
}, { immediate: true })

function handleSync() {
  increase.value = true
  runChatIds.value = [...selectedChats.value]
  runCompletedMessages.value = 0
  bridge.sendEvent(CoreEventType.TakeoutRun, {
    chatIds: selectedChats.value.map(id => id.toString()),
    increase: true,
    syncOptions: syncOptions.value,
  })

  NProgress.start()
}

function handleResync() {
  increase.value = false
  runChatIds.value = [...selectedChats.value]
  runCompletedMessages.value = 0
  bridge.sendEvent(CoreEventType.TakeoutRun, {
    chatIds: selectedChats.value.map(id => id.toString()),
    increase: false,
    syncOptions: syncOptions.value,
  })

  NProgress.start()
}

function handleTakeoutConfirm(useTakeout: boolean) {
  takeoutConfirmNeeded.value = false
  bridge.sendEvent(CoreEventType.TakeoutConfirmResponse, { useTakeout })
}

function handleAbort() {
  if (currentTask.value) {
    bridge.sendEvent(CoreEventType.TakeoutTaskAbort, {
      taskId: currentTask.value.taskId,
    })
    NProgress.done()
  }
  else {
    toast.error(t('sync.noInProgressTask'))
  }
}

function handleCloseStatusPanel() {
  isBottomPanelOpen.value = false
  isMobileStatusOpen.value = false

  if (!isTaskInProgress.value && currentTask.value?.lastError) {
    currentTask.value = undefined
    runChatIds.value = []
    runCompletedMessages.value = 0
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

// Fetch stats for visualization target.
watch(visualizationChatId, (chatId) => {
  if (!chatId) {
    chatStatsFocusedChatId.value = null
    chatStats.value = undefined
    chatStatsLoading.value = false
    return
  }

  chatStatsFocusedChatId.value = String(chatId)
  chatStatsLoading.value = true
  bridge.sendEvent(CoreEventType.TakeoutStatsFetch, {
    chatId: chatId.toString(),
  })
})

// Prefetch selected chats stats silently so aggregate totals can use real totals.
watch(
  selectedChats,
  (chatIds) => {
    for (const chatId of chatIds) {
      const key = String(chatId)
      if (chatStatsByChatId.value[key]?.totalMessages != null) {
        continue
      }
      bridge.sendEvent(CoreEventType.TakeoutStatsFetch, { chatId: key })
    }
  },
  { immediate: true },
)

function startSync() {
  isSyncOptionsDialogOpen.value = false
  handleSync()
}
</script>

<template>
  <div class="h-full flex flex-col bg-background">
    <!-- Header: Hidden on mobile to save space, actions moved to bottom sheet or other menu if needed -->
    <!-- Or simplified for mobile -->
    <header class="h-14 flex items-center justify-between gap-3 border-b bg-card/50 px-4 py-0 backdrop-blur-sm md:h-16 md:px-6">
      <div class="flex items-center gap-3">
        <h1 class="text-lg font-semibold">
          {{ t('sync.sync') }}
        </h1>
      </div>

      <div class="no-scrollbar min-w-0 flex items-center justify-end gap-2 overflow-x-auto md:w-auto md:justify-start md:overflow-visible">
        <Button
          icon="i-lucide-refresh-cw"
          variant="outline"
          size="sm"
          class="h-9 shrink-0 rounded-full px-3 text-xs md:h-9"
          :disabled="isButtonDisabled"
          @click="handleSync"
        >
          <span>{{ t('sync.incrementalSync') }}</span>
        </Button>
        <Button
          icon="i-lucide-rotate-ccw"
          variant="outline"
          size="sm"
          class="h-9 shrink-0 rounded-full px-3 text-xs md:h-9"
          :disabled="isButtonDisabled"
          @click="handleResync"
        >
          <span>{{ t('sync.resync') }}</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          class="h-9 shrink-0 rounded-full px-3 text-xs md:h-9 md:w-auto"
          @click="isSyncOptionsDialogOpen = true"
        >
          <span class="i-lucide-sliders-horizontal mr-2 h-4 w-4" />
          <span>{{ t('sync.syncOptions') }}</span>
        </Button>
      </div>
    </header>

    <div class="flex flex-1 flex-col overflow-hidden">
      <!-- Main Content: Chat Selector -->
      <div class="min-w-0 flex flex-1 flex-col">
        <!-- Chat List Area -->
        <div class="min-h-0 flex-1 p-3 md:p-4">
          <ChatSelector
            v-model:selected-chats="selectedChats"
            v-model:visible-chat-ids="visibleChatIds"
            v-model:active-chat-id="activeChatId"
            :chats="chats"
            :folders="folders"
            class="h-full"
          >
            <template #actions>
              <Button
                v-if="hasMobileStatusContent"
                variant="outline"
                size="sm"
                class="h-8 rounded-full px-3 text-xs md:hidden"
                @click="isMobileStatusOpen = true"
              >
                <span class="i-lucide-panel-bottom mr-2 h-3.5 w-3.5" />
                {{ t('sync.showStats') }}
              </Button>

              <div v-else />

              <!-- Right side: Selection & Stats -->
              <div class="flex items-center gap-2">
                <div
                  v-if="selectedChats.length > 0"
                  class="flex shrink-0 items-center gap-2 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary font-medium"
                >
                  <span class="i-lucide-check-circle h-3.5 w-3.5" />
                  <span class="hidden sm:inline">{{ t('sync.selectedChats', { count: selectedChats.length }) }}</span>
                  <span class="sm:hidden">{{ selectedChats.length }}</span>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  class="h-8 px-2 text-xs"
                  :disabled="isSelectAllDisabled"
                  @click="handleSelectAll"
                >
                  <span class="i-lucide-check-square h-3.5 w-3.5 sm:mr-2" />
                  <span class="hidden sm:inline">{{ isAllSelected ? t('sync.deselectAll') : t('sync.selectAll') }}</span>
                </Button>
              </div>
            </template>
          </ChatSelector>
        </div>

        <div v-if="!isBottomPanelOpen" class="justify-end px-3 pb-3 hidden md:flex md:px-4">
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8 text-muted-foreground"
            :title="t('sync.showStats')"
            @click="isBottomPanelOpen = !isBottomPanelOpen"
          >
            <span class="i-lucide-panel-bottom h-4 w-4" />
          </Button>
        </div>
      </div>

      <!-- Bottom Panel: Status & Info -->
      <div
        class="shrink-0 overflow-hidden border-t bg-background/95 backdrop-blur-sm transition-all duration-300 ease-in-out hidden md:block"
        :class="[
          isBottomPanelOpen ? 'max-h-[58vh] opacity-100 md:max-h-[24rem]' : 'max-h-0 opacity-0',
        ]"
      >
        <div class="max-h-[58vh] overflow-y-auto px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 md:max-h-none md:overflow-visible md:pb-3">
          <div>
            <div
              class="grid min-h-0 gap-0"
              :class="shouldShowTaskStatus || shouldShowSelectionSummary
                ? 'md:grid-cols-[336px_minmax(0,1fr)]'
                : 'grid-cols-1'"
            >
              <SyncSelectedSummaryPanel
                v-if="shouldShowTaskStatus || shouldShowSelectionSummary"
                :label="t('sync.selectedChatsLabel')"
                :title="summarySelectionTitle"
                :progress="summaryProgress"
                :total-count="summaryTotalCount"
                :synced-count="summarySyncedCount"
                :unsynced-count="summaryUnsyncedCount"
                :has-error="summaryHasError"
              />

              <div class="min-w-0 p-3 pt-3 md:p-4 md:pt-3">
                <div v-if="visualizationChat" class="space-y-3">
                  <SyncVisualization
                    :stats="chatStats"
                    :loading="chatStatsLoading"
                    :chat-label="visualizationChat.name || ''"
                    :show-abort="isTaskInProgress"
                    :show-close="true"
                    class="w-full"
                    @abort="handleAbort"
                    @close="handleCloseStatusPanel"
                  />
                </div>

                <div v-else class="flex items-center gap-3 py-8 text-muted-foreground/60">
                  <span class="i-lucide-bar-chart-2 h-8 w-8 opacity-40" />
                  <p class="text-sm">
                    {{ t('sync.selectChatToViewStats') }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <MobileSyncStatsDrawer
        v-if="hasMobileStatusContent"
        v-model:open="isMobileStatusOpen"
        v-model:selected-tab="mobileStatusTab"
        :has-selected-status-panel="hasSelectedStatusPanel"
        :has-current-status-panel="hasCurrentStatusPanel"
        :selected-label="t('sync.selectedChatsLabel')"
        :current-label="t('sync.currentChatLabel')"
        :selected-title="summarySelectionTitle"
        :selected-progress="summaryProgress"
        :selected-total-count="summaryTotalCount"
        :selected-synced-count="summarySyncedCount"
        :selected-unsynced-count="summaryUnsyncedCount"
        :selected-has-error="summaryHasError"
        :current-title="t('sync.syncVisualization')"
        :current-subtitle="visualizationChat?.name || ''"
        :current-progress="currentChatProgress"
        :current-total-count="currentChatTotalCount"
        :current-synced-count="currentChatSyncedCount"
        :current-unsynced-count="currentChatUnsyncedCount"
        :current-loading="chatStatsLoading && !chatStats"
        class="md:hidden"
        @close="handleCloseStatusPanel"
      />
    </div>

    <!-- Sync Options Dialog -->
    <Dialog v-model:open="isSyncOptionsDialogOpen">
      <DialogContent class="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl outline-none ring-0 sm:max-w-[500px] focus-visible:outline-none focus-visible:ring-0">
        <DialogHeader>
          <DialogTitle>{{ t('sync.syncOptions') }}</DialogTitle>
          <DialogDescription>
            {{ t('sync.syncOptionsDescription') }}
          </DialogDescription>
        </DialogHeader>

        <div class="grid gap-4 py-4">
          <!-- Sync Media Switch -->
          <div class="flex items-center justify-between space-x-2">
            <label
              for="sync-media"
              class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {{ t('sync.syncMedia') }}
            </label>
            <Switch
              id="sync-media"
              :checked="syncMedia"
              @update:checked="(v: boolean) => syncMedia = v"
            />
          </div>

          <!-- Max Media Size Input -->
          <div class="grid gap-2">
            <label
              for="max-media-size"
              class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {{ t('sync.maxMediaSize') }} (MB)
            </label>
            <Input
              id="max-media-size"
              v-model.number="maxMediaSize"
              type="number"
              class="col-span-3"
            />
            <p class="text-[0.8rem] text-muted-foreground">
              {{ t('sync.maxMediaSizeDescription') }}
            </p>
          </div>

          <!-- Date Range Picker -->
          <div class="grid gap-2">
            <label class="text-sm font-medium leading-none">
              {{ t('sync.timeRange') }}
            </label>
            <div class="flex flex-col gap-2">
              <DateRangePickerRoot
                id="date-range"
                v-model="timeRange"
                class="w-full"
              >
                <DateRangePickerTrigger>
                  <Button
                    variant="outline"
                    class="w-full justify-start text-left font-normal"
                    :class="!timeRange ? 'text-muted-foreground' : ''"
                  >
                    <span class="i-lucide-calendar mr-2 h-4 w-4" />
                    <template v-if="timeRange?.start">
                      <template v-if="timeRange.end">
                        {{ formattedRangeLabel }}
                      </template>
                      <template v-else>
                        {{ formattedRangeLabel }}
                      </template>
                    </template>
                    <template v-else>
                      {{ t('sync.selectDateRange') }}
                    </template>
                  </Button>
                </DateRangePickerTrigger>
                <DateRangePickerContent class="z-50 w-auto border rounded-md bg-popover p-0 shadow-md" align="start">
                  <DateRangePickerCalendar v-slot="{ weekDays, grid }" class="p-3">
                    <DateRangePickerHeader class="flex items-center justify-between">
                      <DateRangePickerPrev>
                        <div class="h-7 w-7 flex items-center justify-center rounded bg-transparent hover:bg-muted">
                          <span class="i-lucide-chevron-left h-4 w-4" />
                        </div>
                      </DateRangePickerPrev>
                      <DateRangePickerHeading class="text-sm font-medium" />
                      <DateRangePickerNext>
                        <div class="h-7 w-7 flex items-center justify-center rounded bg-transparent hover:bg-muted">
                          <span class="i-lucide-chevron-right h-4 w-4" />
                        </div>
                      </DateRangePickerNext>
                    </DateRangePickerHeader>
                    <DateRangePickerGrid class="mt-4 w-full border-collapse select-none space-y-1">
                      <DateRangePickerGridHead>
                        <DateRangePickerGridRow class="mb-1 w-full flex justify-between">
                          <DateRangePickerHeadCell
                            v-for="day in weekDays"
                            :key="day"
                            class="w-8 rounded-md text-[0.8rem] text-muted-foreground font-normal"
                          >
                            {{ day }}
                          </DateRangePickerHeadCell>
                        </DateRangePickerGridRow>
                      </DateRangePickerGridHead>
                      <DateRangePickerGridBody>
                        <DateRangePickerGridRow
                          v-for="(weekDates, index) in (grid as unknown as DateValue[][])"
                          :key="index"
                          class="mt-2 w-full flex"
                        >
                          <DateRangePickerCell
                            v-for="weekDate in weekDates"
                            :key="weekDate.toString()"
                            :date="weekDate"
                          >
                            <DateRangePickerCellTrigger
                              :day="weekDate"
                              :month="weekDate"
                              class="relative h-8 w-8 flex items-center justify-center whitespace-nowrap border border-transparent rounded-md text-sm font-normal ring-offset-background transition-colors disabled:pointer-events-none data-[selected]:bg-primary data-[today]:bg-accent hover:bg-accent data-[selected]:text-primary-foreground data-[today]:text-accent-foreground hover:text-accent-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring data-[selected]:hover:bg-primary data-[selected]:hover:text-primary-foreground"
                            />
                          </DateRangePickerCell>
                        </DateRangePickerGridRow>
                      </DateRangePickerGridBody>
                    </DateRangePickerGrid>
                  </DateRangePickerCalendar>
                </DateRangePickerContent>
              </DateRangePickerRoot>
            </div>
          </div>
        </div>

        <DialogFooter class="gap-3 sm:gap-0">
          <Button variant="outline" @click="isSyncOptionsDialogOpen = false">
            {{ t('common.cancel') }}
          </Button>
          <Button @click="startSync">
            {{ t('sync.startSync') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="takeoutConfirmNeeded">
      <DialogContent class="max-w-[calc(100%-2rem)] rounded-2xl sm:max-w-[560px]" :show-close-button="false">
        <DialogHeader>
          <div class="flex items-start gap-4 text-left">
            <div class="h-12 w-12 flex shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/30">
              <span class="i-lucide-shield-check h-6 w-6 text-primary" />
            </div>
            <div class="min-w-0 flex-1">
              <DialogTitle>{{ t('sync.takeoutConfirmTitle') }}</DialogTitle>
              <DialogDescription class="mt-2 text-sm leading-relaxed">
                {{ t('sync.takeoutConfirmDescription') }}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div class="flex items-start gap-3 border border-destructive/30 rounded-lg bg-destructive/5 p-3">
          <span class="i-lucide-alert-triangle mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p class="text-sm text-destructive leading-relaxed">
            {{ t('sync.takeoutConfirmRisk') }}
          </p>
        </div>

        <DialogFooter class="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            icon="i-lucide-shield-off"
            variant="outline"
            class="w-full border-destructive/40 text-destructive sm:w-auto hover:bg-destructive/10"
            @click="handleTakeoutConfirm(false)"
          >
            {{ t('sync.takeoutConfirmUseGetHistory') }}
          </Button>
          <Button
            icon="i-lucide-shield-check"
            class="w-full sm:w-auto"
            @click="handleTakeoutConfirm(true)"
          >
            {{ t('sync.takeoutConfirmAuthorize') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Select All Reminder Dialog -->
    <Dialog v-model:open="isSelectAllDialogOpen">
      <DialogContent class="max-w-[calc(100%-2rem)] rounded-2xl sm:max-w-[425px]" :show-close-button="false">
        <DialogHeader>
          <div class="flex items-center gap-4">
            <div
              class="h-10 w-10 flex shrink-0 items-center justify-center rounded-full"
              :class="isSelectAllWarning ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'"
            >
              <span
                class="h-5 w-5"
                :class="isSelectAllWarning ? 'i-lucide-alert-triangle' : 'i-lucide-info'"
              />
            </div>
            <div class="flex flex-col gap-1 text-left">
              <DialogTitle>
                {{ t('sync.selectAll') }}
              </DialogTitle>
              <DialogDescription>
                {{ isSelectAllWarning
                  ? t('sync.selectAllWarning', { count: selectAllCount })
                  : t('sync.selectAllInfo', { count: selectAllCount })
                }}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogFooter class="sm:justify-end">
          <Button class="w-full sm:w-auto" @click="isSelectAllDialogOpen = false">
            {{ t('sync.dismiss') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
