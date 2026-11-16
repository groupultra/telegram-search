<script setup lang="ts">
import type { ChatGroup } from '@tg-search/client'
import type { CoreDialog } from '@tg-search/core/types'

import { useLogger } from '@guiiai/logg'
import { prefillChatAvatarIntoStore, useChatStore, useSettingsStore } from '@tg-search/client'
import { useMediaQuery } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { VList } from 'virtua/vue'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import ChatListItem from './ChatListItem.vue'

import { useChatListSelection } from '../../composables/use-chat-list-selection'
import { filterChatsByQuery, getChatPreview, matchesFolder, sortChatsForFolder } from '../../utils/chat-list'
import { Button } from '../ui/Button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '../ui/ContextMenu'
import { Empty } from '../ui/Empty'
import { Input } from '../ui/Input'

const props = defineProps<{
  searchQuery: string
}>()
const emit = defineEmits<{
  'update:searchQuery': [value: string]
}>()

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const chatStore = useChatStore()
const settingsStore = useSettingsStore()
const { selectedGroup, selectedFolderId } = storeToRefs(settingsStore)
const isCoarsePointer = useMediaQuery('(pointer: coarse)')

const chats = computed(() => chatStore.chats)
const folders = computed(() => chatStore.folders)
const normalizedSelectedFolderId = computed(() => {
  if (selectedFolderId.value == null) {
    return undefined
  }

  const folderId = Number(selectedFolderId.value)
  return Number.isFinite(folderId) ? folderId : undefined
})
const searchValue = computed({
  get: () => props.searchQuery,
  set: value => emit('update:searchQuery', value),
})
const {
  aiContextCount,
  cancelLongPress,
  clearAIContextChats,
  consumeLongPressTrigger,
  handleDesktopAddToAI,
  isAIChatDrawerOpen,
  isChatInAIContext,
  isSelectionMode,
  openAIChatWithSelectedChats,
  showAIContextHint,
  startLongPress,
  toggleAIContextChat,
} = useChatListSelection((key, params) => params ? t(key, params) : t(key))

// Filter based on search query
const chatsFiltered = computed(() => {
  return filterChatsByQuery(chats.value || [], props.searchQuery)
})

// Determine active group based on route or selection
const activeChatGroup = computed(() => {
  if (route.params.id) {
    if (selectedGroup.value === undefined) {
      return undefined
    }
  }
  return selectedGroup.value
})

const activeFolder = computed(() => {
  if (activeChatGroup.value !== 'folder' || normalizedSelectedFolderId.value === undefined) {
    return undefined
  }

  return folders.value.find(folder => Number(folder.id) === normalizedSelectedFolderId.value)
})

// Filtered chats by active group or folder
const activeGroupChats = computed(() => {
  const filtered = chatsFiltered.value || []

  // 1. Handle Folders
  if (activeFolder.value) {
    const folder = activeFolder.value
    const folderChats = filtered.filter(chat => matchesFolder(chat, folder))
    return sortChatsForFolder(folderChats, folder)
  }

  // 2. Handle "All Chats"
  // Preserve the store order for the global list so pinned chats follow
  // Telegram's pinnedDialogIds instead of being re-sorted by message time here.
  return filtered
})

const chatPreviews = computed(() => {
  return new Map(activeGroupChats.value.map(chat => [chat.id, getChatPreview(chat)]))
})

function isChatPinned(chat: CoreDialog) {
  if (activeFolder.value) {
    return activeFolder.value.pinnedChatIds?.some(id => Number(id) === Number(chat.id)) ?? false
  }

  return !!chat.pinned
}

function toggleActiveChatGroup(group: ChatGroup) {
  selectedGroup.value = group
  if (group !== 'folder') {
    selectedFolderId.value = undefined
  }
}

function selectFolder(folderId: number) {
  selectedGroup.value = 'folder'
  selectedFolderId.value = folderId
}

function handleChatClick(chatId: number) {
  if (consumeLongPressTrigger(chatId)) {
    return
  }

  if (isSelectionMode.value) {
    toggleAIContextChat(chatId)
    return
  }

  void router.push(`/chat/${chatId}`)
}

/**
 * Prefill chat avatars from persistent cache in parallel.
 * - Avoids sequential IndexedDB waits when chat list is large.
 * - Only warms cache; network fetch continues to be driven by server events.
 */
async function prefillChatAvatarsParallel(list: CoreDialog[]) {
  const tasks = list
    .filter(chat => chat?.id != null)
    .map(chat => prefillChatAvatarIntoStore(chat.id))
  try {
    await Promise.all(tasks)
  }
  catch (error) {
    useLogger('avatars').withError(error).warn('Failed to prefill chat avatars')
  }
}

/**
 * Prefill avatars for currently visible chats only.
 * - Warms disk -> memory cache for first `count` items
 * - Does NOT trigger network; visible elements use composable ensure
 */
async function prioritizeVisibleAvatars(list: CoreDialog[], count = 50) {
  const top = list.slice(0, count)
  await prefillChatAvatarsParallel(top)
}

// Prioritize visible avatars on group change and initial render
watch(activeGroupChats, (list) => {
  if (!list?.length)
    return
  void prioritizeVisibleAvatars(list)
}, { immediate: true })

// Folder tabs scroll horizontally when they overflow. The sliding highlight
// that used to follow the active tab was removed: tabs now share the Segmented
// look, where the active item carries its own background.
const containerRef = ref<HTMLElement | null>(null)
const canDragTabs = ref(false)

function updateTabScrollability() {
  const container = containerRef.value
  canDragTabs.value = container !== null && container.scrollWidth > container.clientWidth
}

// Use ResizeObserver for more robustness
let resizeObserver: ResizeObserver | undefined
watch(containerRef, (el) => {
  resizeObserver?.disconnect()
  if (el) {
    resizeObserver = new ResizeObserver(() => updateTabScrollability())
    resizeObserver.observe(el)
  }
})

watch(() => chatStore.folders, () => nextTick(updateTabScrollability))

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})

// @unocss-include
// Same metrics as a small Segmented item, in a scrollable row.
const FOLDER_TAB_CLASS = 'h-7 inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-2.5 text-[13px] text-fg-2 font-medium leading-none transition-colors duration-200 hover:text-fg'
const FOLDER_TAB_ACTIVE_CLASS = 'bg-fill-2 text-fg!'

const isDraggingTabs = ref(false)
let dragPointerId: number | undefined
let dragStartX = 0
let dragStartScrollLeft = 0
let suppressNextTabClick = false

function getNormalizedWheelDelta(event: WheelEvent, container: HTMLElement) {
  const dominantDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
  if (dominantDelta === 0) {
    return 0
  }

  switch (event.deltaMode) {
    case WheelEvent.DOM_DELTA_LINE:
      return dominantDelta * 16
    case WheelEvent.DOM_DELTA_PAGE:
      return dominantDelta * container.clientWidth
    default:
      return dominantDelta
  }
}

function handleTabWheel(event: WheelEvent) {
  const container = containerRef.value
  if (!container) {
    return
  }

  const canScrollHorizontally = container.scrollWidth > container.clientWidth
  if (!canScrollHorizontally) {
    return
  }

  const delta = getNormalizedWheelDelta(event, container)
  if (delta === 0) {
    return
  }

  const maxScrollLeft = container.scrollWidth - container.clientWidth
  const nextScrollLeft = Math.max(0, Math.min(maxScrollLeft, container.scrollLeft + delta))
  if (nextScrollLeft === container.scrollLeft) {
    return
  }

  event.preventDefault()
  container.scrollLeft = nextScrollLeft
}

function handleTabPointerDown(event: PointerEvent) {
  if (isCoarsePointer.value || event.pointerType === 'touch' || event.button !== 0 || !containerRef.value || !canDragTabs.value) {
    return
  }

  dragPointerId = event.pointerId
  dragStartX = event.clientX
  dragStartScrollLeft = containerRef.value.scrollLeft
  isDraggingTabs.value = false
}

function handleTabPointerMove(event: PointerEvent) {
  const container = containerRef.value
  if (!container || dragPointerId !== event.pointerId) {
    return
  }

  const deltaX = event.clientX - dragStartX
  if (!isDraggingTabs.value && Math.abs(deltaX) > 4) {
    isDraggingTabs.value = true
    suppressNextTabClick = true
    container.setPointerCapture(event.pointerId)
  }

  if (!isDraggingTabs.value) {
    return
  }

  event.preventDefault()
  container.scrollLeft = dragStartScrollLeft - deltaX
}

function endTabDrag(event?: PointerEvent) {
  const container = containerRef.value
  if (container && dragPointerId !== undefined && event?.pointerId === dragPointerId && container.hasPointerCapture(dragPointerId)) {
    container.releasePointerCapture(dragPointerId)
  }

  // Cancelled drags do not emit a click, so clear suppression here.
  if (event?.type === 'pointercancel') {
    suppressNextTabClick = false
  }

  dragPointerId = undefined
  isDraggingTabs.value = false
}

function handleTabClickCapture(event: MouseEvent) {
  if (!suppressNextTabClick) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  suppressNextTabClick = false
}
</script>

<template>
  <div class="relative min-h-0 flex flex-1 flex-col">
    <div class="flex flex-col gap-2 px-3 pb-2">
      <Input
        v-model="searchValue"
        type="text"
        variant="filled"
        prefix-icon="i-lucide-search"
        :placeholder="t('search.search')"
      />

      <div
        ref="containerRef"
        role="tablist"
        :class="isDraggingTabs ? 'cursor-grabbing select-none' : canDragTabs ? 'cursor-grab' : ''"
        class="no-scrollbar flex items-center gap-1 overflow-x-auto px-3 -mx-3"
        @click.capture="handleTabClickCapture"
        @pointercancel="endTabDrag"
        @pointerdown="handleTabPointerDown"
        @pointermove="handleTabPointerMove"
        @pointerup="endTabDrag"
        @wheel="handleTabWheel"
      >
        <button
          type="button"
          role="tab"
          :aria-selected="activeChatGroup === undefined"
          :class="[FOLDER_TAB_CLASS, activeChatGroup === undefined ? FOLDER_TAB_ACTIVE_CLASS : '']"
          @click="toggleActiveChatGroup(undefined)"
        >
          {{ t('chatGroups.all') }}
        </button>

        <button
          v-for="folder in folders"
          :key="folder.id"
          type="button"
          role="tab"
          :aria-selected="activeChatGroup === 'folder' && normalizedSelectedFolderId === folder.id"
          :class="[FOLDER_TAB_CLASS, activeChatGroup === 'folder' && normalizedSelectedFolderId === folder.id ? FOLDER_TAB_ACTIVE_CLASS : '']"
          @click="selectFolder(folder.id)"
        >
          {{ folder.title }}
        </button>
      </div>

      <div
        v-if="showAIContextHint && aiContextCount === 0"
        class="flex items-center gap-2 rounded-md bg-fill-3 px-3 py-2 text-xs text-fg-2"
      >
        <span class="i-lucide-sparkles h-3.5 w-3.5 shrink-0" />
        <span>{{ t('chatList.aiContextHint') }}</span>
      </div>
    </div>

    <!-- Chat list -->
    <div class="min-h-0 flex-1 overflow-hidden">
      <VList
        v-if="activeGroupChats.length > 0"
        :data="activeGroupChats"
        class="chat-list h-full px-2 pb-2"
      >
        <template #default="{ item: chat }">
          <ContextMenu v-if="chat && !isCoarsePointer">
            <ContextMenuTrigger as-child>
              <ChatListItem
                :key="chat.id"
                :chat="chat"
                :preview="chatPreviews.get(chat.id)"
                :active="$route.params.id === chat.id.toString()"
                :pinned="isChatPinned(chat)"
                :in-ai-context="isChatInAIContext(chat.id)"
                :selection-mode="isSelectionMode"
                @pointerdown="startLongPress(chat.id)"
                @pointerup="cancelLongPress"
                @pointerleave="cancelLongPress"
                @pointercancel="cancelLongPress"
                @click="handleChatClick(chat.id)"
              />
            </ContextMenuTrigger>
            <ContextMenuContent class="min-w-[180px]">
              <ContextMenuItem @select="handleDesktopAddToAI(chat.id)">
                <span class="i-lucide-sparkles h-4 w-4" />
                {{ t('chatList.addToAIContext') }}
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>

          <ChatListItem
            v-else-if="chat"
            :key="chat.id"
            :chat="chat"
            :preview="chatPreviews.get(chat.id)"
            :active="$route.params.id === chat.id.toString()"
            :pinned="isChatPinned(chat)"
            :in-ai-context="isChatInAIContext(chat.id)"
            :selection-mode="isSelectionMode"
            @pointerdown="startLongPress(chat.id)"
            @pointerup="cancelLongPress"
            @pointerleave="cancelLongPress"
            @pointercancel="cancelLongPress"
            @contextmenu.prevent
            @click="handleChatClick(chat.id)"
          />
        </template>
      </VList>

      <!-- Empty State -->
      <Empty v-else icon="i-lucide-message-square-dashed" :title="t('chatList.noChatsFound')" />
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="aiContextCount > 0"
      class="pointer-events-none fixed left-1/2 z-40 w-[min(calc(100vw-1.5rem),26rem)] md:bottom-8 md:left-[calc(var(--app-sidebar-width)+(100vw-var(--app-sidebar-width))/2)] md:w-[min(28rem,calc(100vw-var(--app-sidebar-width)-4rem))] -translate-x-1/2"
      :class="isAIChatDrawerOpen ? 'bottom-32' : 'bottom-20'"
    >
      <div class="pointer-events-auto flex items-center gap-2 rounded-lg bg-elevated p-2 pl-3 text-fg shadow-popup">
        <span class="i-lucide-sparkles h-4 w-4 shrink-0 text-fg-2" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium leading-5">
            {{ t('chatList.aiContextReady') }}
          </p>
          <p class="truncate text-xs text-fg-3 leading-4">
            {{ isSelectionMode ? t('chatList.selectionModeCount', { count: aiContextCount }) : t('chatList.aiContextCount', { count: aiContextCount }) }}
          </p>
        </div>

        <Button variant="text" @click="clearAIContextChats">
          {{ t('common.cancel') }}
        </Button>
        <Button variant="primary" @click="openAIChatWithSelectedChats">
          {{ t('aiChat.aiChat') }}
          <span class="i-lucide-arrow-right h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.chat-list :deep(.chat-list-item) {
  -webkit-touch-callout: none;
  user-select: none;
}
</style>
