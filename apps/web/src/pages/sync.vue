<script setup lang="ts">
import type { SyncOptions } from '@tg-search/core'
import type { DateRange, DateValue } from 'reka-ui'

import NProgress from 'nprogress'

import { getErrorMessage, useAccountStore, useBridge, useChatStore, useSyncTaskStore } from '@tg-search/client'
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
import { Progress } from '../components/ui/Progress'
import { Switch } from '../components/ui/Switch'
import {
  formatRangeLabel,
  sameRange,
  toDateRange,
  toTimestampMs,
} from '../utils/date-range'

const { t } = useI18n()

const selectedChats = ref<number[]>([])
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
const { currentTask, currentTaskProgress, increase, chatStats, chatStatsLoading, etaSeconds, takeoutConfirmNeeded } = storeToRefs(syncTaskStore)

// Currently focused chat id for status panel; independent from multi-selection
const activeChatId = ref<number | null>(null)

// Sync options dialog state
const isSyncOptionsDialogOpen = ref(false)
const isDesktop = useMediaQuery('(min-width: 768px)')
const isRightSidebarOpen = ref(isDesktop.value)

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

const activeChat = computed(() => {
  if (!activeChatId.value)
    return undefined
  return chats.value.find(chat => chat.id === activeChatId.value)
})

// Format ETA string
const etaMessage = computed(() => {
  if (etaSeconds.value === null || etaSeconds.value === undefined)
    return ''

  const minutes = Math.floor(etaSeconds.value / 60)
  const seconds = etaSeconds.value % 60

  if (minutes > 0) {
    return t('sync.etaTime', { minutes, seconds })
  }
  return t('sync.etaSeconds', { seconds })
})

// Default to incremental sync
if (increase.value === undefined || increase.value === null) {
  increase.value = true
}

// Automatically switch active visualization to the currently syncing chat
watch(currentTask, (task) => {
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
  return selectedChats.value.length === 0 || isTaskInProgress.value
})

/**
 * Compute disabled state for the "Select All" button.
 * Disabled when: not logged in, a task is in progress, or no chats.
 */
const isSelectAllDisabled = computed(() => {
  return isTaskInProgress.value || chats.value.length === 0
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
  bridge.sendEvent(CoreEventType.TakeoutRun, {
    chatIds: selectedChats.value.map(id => id.toString()),
    increase: true,
    syncOptions: syncOptions.value,
  })

  NProgress.start()
}

function handleResync() {
  increase.value = false
  bridge.sendEvent(CoreEventType.TakeoutRun, {
    chatIds: selectedChats.value.map(id => id.toString()),
    increase: false,
    syncOptions: syncOptions.value,
  })

  NProgress.start()
}

function handleAbort() {
  if (currentTask.value) {
    bridge.sendEvent(CoreEventType.TakeoutTaskAbort, {
      taskId: currentTask.value.taskId,
    })
  }
  else {
    toast.error(t('sync.noInProgressTask'))
  }
}

function handleTakeoutConfirm(useTakeout: boolean) {
  takeoutConfirmNeeded.value = false
  bridge.sendEvent(CoreEventType.TakeoutConfirmResponse, { useTakeout })
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
  bridge.sendEvent(CoreEventType.TakeoutStatsFetch, {
    chatId: chatId.toString(),
  })
})

function startSync() {
  isSyncOptionsDialogOpen.value = false
  handleSync()
}
</script>

<template>
  <div class="h-full flex flex-col bg-background">
    <!-- Header: Hidden on mobile to save space, actions moved to bottom sheet or other menu if needed -->
    <!-- Or simplified for mobile -->
    <header class="h-14 flex items-center justify-between border-b bg-card/50 px-4 py-0 backdrop-blur-sm md:h-16 md:px-6">
      <div class="flex items-center gap-3">
        <h1 class="text-lg font-semibold">
          {{ t('sync.sync') }}
        </h1>
      </div>

      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          class="h-8 w-8 rounded-full px-0 md:h-9 md:w-auto md:px-3"
          @click="isSyncOptionsDialogOpen = true"
        >
          <span class="i-lucide-sliders-horizontal h-4 w-4 md:mr-2" />
          <span class="hidden md:inline">{{ t('sync.syncOptions') }}</span>
        </Button>
      </div>
    </header>

    <div class="relative flex flex-1 overflow-hidden">
      <!-- Main Content: Chat Selector -->
      <div class="min-w-0 flex flex-1 flex-col">
        <!-- Chat List Area -->
        <div class="min-h-0 flex-1 p-4">
          <ChatSelector
            v-model:selected-chats="selectedChats"
            v-model:active-chat-id="activeChatId"
            :chats="chats"
            :folders="folders"
            class="h-full"
          >
            <template #actions>
              <!-- Left side: Sync Actions -->
              <div class="flex items-center gap-2">
                <Button
                  icon="i-lucide-refresh-cw"
                  variant="ghost"
                  size="sm"
                  class="h-8 px-2 text-xs"
                  :disabled="isButtonDisabled"
                  @click="handleSync"
                >
                  <span class="inline">{{ t('sync.incrementalSync') }}</span>
                </Button>
                <Button
                  icon="i-lucide-rotate-ccw"
                  variant="ghost"
                  size="sm"
                  class="h-8 px-2 text-xs"
                  :disabled="isButtonDisabled"
                  @click="handleResync"
                >
                  <span class="inline">{{ t('sync.resync') }}</span>
                </Button>
              </div>

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

                <Button
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8 text-muted-foreground"
                  :class="isRightSidebarOpen ? 'bg-muted/50 text-foreground' : ''"
                  :title="isRightSidebarOpen ? t('sync.hideStats') : t('sync.showStats')"
                  @click="isRightSidebarOpen = !isRightSidebarOpen"
                >
                  <span class="i-lucide-panel-right h-4 w-4" />
                </Button>
              </div>
            </template>
          </ChatSelector>
        </div>
      </div>

      <!-- Right Sidebar: Status & Info -->
      <!-- Mobile: Overlay, Desktop: Side Panel -->
      <div
        class="fixed inset-0 z-50 flex shrink-0 flex-col overflow-y-auto border-l bg-background transition-all duration-300 ease-in-out md:static md:z-auto md:bg-muted/10"
        :class="[
          isRightSidebarOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 md:translate-x-0 md:w-0 md:opacity-0',
          'md:border-l',
        ]"
      >
        <div class="h-full w-full flex flex-col bg-background md:w-80">
          <!-- Mobile Header for Sidebar -->
          <div class="flex items-center justify-between border-b p-4 md:hidden">
            <h3 class="font-semibold">
              {{ t('sync.syncVisualization') }}
            </h3>
            <Button variant="ghost" size="icon" @click="isRightSidebarOpen = false">
              <span class="i-lucide-x h-5 w-5" />
            </Button>
          </div>

          <!-- Active Task Status -->
          <div v-if="shouldShowTaskStatus" class="border-b bg-background p-4">
            <div class="mb-3 flex items-center gap-3">
              <div
                class="h-8 w-8 flex shrink-0 items-center justify-center rounded-lg"
                :class="currentTask?.lastError ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'"
              >
                <span v-if="currentTask?.lastError" class="i-lucide-alert-circle h-4 w-4" />
                <span v-else class="i-lucide-loader-2 h-4 w-4 animate-spin" />
              </div>
              <div class="min-w-0 flex-1">
                <h3 class="truncate text-sm font-medium">
                  {{ currentTask?.lastError ? t('sync.syncFailed') : t('sync.syncing') }}
                </h3>
                <p v-if="etaMessage && !currentTask?.lastError" class="text-xs text-muted-foreground">
                  {{ etaMessage }}
                </p>
              </div>
            </div>

            <div v-if="currentTask?.lastError" class="mb-3 break-words text-xs text-destructive">
              {{ errorMessage }}
            </div>
            <div v-else class="mb-3 space-y-1">
              <div class="flex justify-between text-xs text-muted-foreground">
                <span>{{ localizedTaskMessage }}</span>
                <span>{{ Math.round(currentTaskProgress) }}%</span>
              </div>
              <Progress :progress="currentTaskProgress" class="h-1.5" />
            </div>

            <div class="flex justify-end gap-2">
              <Button
                v-if="currentTask?.lastError"
                variant="outline"
                size="sm"
                class="h-7 text-xs"
                @click="syncTaskStore.currentTask = undefined"
              >
                {{ t('sync.dismiss') }}
              </Button>
              <Button
                v-else
                variant="outline"
                size="sm"
                class="h-7 text-xs"
                @click="handleAbort"
              >
                {{ t('sync.cancel') }}
              </Button>
            </div>
          </div>

          <!-- Sync Visualization (Stats) -->
          <div class="flex-1 p-4">
            <div v-if="activeChat" class="space-y-4">
              <div class="mb-2 flex items-center gap-3">
                <div class="h-10 w-10 flex items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground">
                  <!-- Simple Avatar Placeholder if EntityAvatar is not available here,
                        or we can import EntityAvatar if needed.
                        For now, use icon. -->
                  <span class="i-lucide-message-circle h-5 w-5" />
                </div>
                <div>
                  <h3 class="text-sm font-medium">
                    {{ activeChat.name || t('chatSelector.chat', { id: activeChat.id }) }}
                  </h3>
                  <p class="text-xs text-muted-foreground">
                    {{ t('chatSelector.id', { id: activeChat.id }) }}
                  </p>
                </div>
              </div>

              <SyncVisualization
                :stats="chatStats"
                :loading="chatStatsLoading"
                :chat-label="activeChat.name || ''"
                class="w-full"
              />
            </div>

            <div v-else class="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground/50">
              <span class="i-lucide-bar-chart-2 mb-2 h-12 w-12 opacity-20" />
              <p class="text-sm">
                {{ t('sync.selectChatToViewStats') }}
              </p>
            </div>
          </div>
        </div>
      </div>
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
