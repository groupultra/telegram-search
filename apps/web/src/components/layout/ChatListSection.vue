<script setup lang="ts">
import type { ChatGroup } from '@tg-search/client'
import type { CoreDialog } from '@tg-search/core/types'
import type { ComponentPublicInstance } from 'vue'

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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '../ui/ContextMenu'
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

// Smooth sliding background for folder tabs
const containerRef = ref<HTMLElement | null>(null)
// We use a Map or logic to collect refs because mixing static and v-for refs is tricky
const allTabs = ref<Map<string, HTMLElement>>(new Map())

function setAllTabRef(el: Element | ComponentPublicInstance | null) {
  if (el) {
    allTabs.value.set('all', el as HTMLElement)
  }
}

function setFolderTabRef(el: Element | ComponentPublicInstance | null, id: number) {
  if (el) {
    allTabs.value.set(`folder-${id}`, el as HTMLElement)
  }
}

const gliderStyle = ref({
  width: '0px',
  transform: 'translateX(0px)',
  opacity: 0,
})
const canDragTabs = ref(false)

function updateTabScrollability() {
  const container = containerRef.value
  canDragTabs.value = container !== null && container.scrollWidth > container.clientWidth
}

function updateGlider() {
  if (!containerRef.value) {
    canDragTabs.value = false
    return
  }

  updateTabScrollability()

  const containerRect = containerRef.value.getBoundingClientRect()
  let activeEl: HTMLElement | undefined

  if (activeChatGroup.value === undefined) {
    activeEl = allTabs.value.get('all')
  }
  else if (activeChatGroup.value === 'folder' && normalizedSelectedFolderId.value !== undefined) {
    activeEl = allTabs.value.get(`folder-${normalizedSelectedFolderId.value}`)
  }

  if (activeEl) {
    const elRect = activeEl.getBoundingClientRect()
    // Calculate relative position within the scrollable container
    const scrollLeft = containerRef.value.scrollLeft
    // Account for the padding/left-3 offset (12px)
    const relativeLeft = elRect.left - containerRect.left + scrollLeft - 12

    gliderStyle.value = {
      width: `${elRect.width}px`,
      transform: `translateX(${relativeLeft}px)`,
      opacity: 1,
    }
  }
  else {
    gliderStyle.value = {
      ...gliderStyle.value,
      opacity: 0,
    }
  }
}

// Update glider when selection changes
watch(
  [activeChatGroup, normalizedSelectedFolderId, folders],
  () => {
    nextTick(() => {
      updateGlider()
    })
  },
  { immediate: true },
)

// Update glider on resize
// Use ResizeObserver for more robustness
let resizeObserver: ResizeObserver | undefined
watch(containerRef, (el) => {
  if (el) {
    resizeObserver = new ResizeObserver(() => updateGlider())
    resizeObserver.observe(el)
  }
  else {
    resizeObserver?.disconnect()
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})

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
  updateGlider()
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
  updateGlider()
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
    <div class="flex flex-col gap-2 px-3 pb-2 pt-1">
      <div class="relative">
        <div
          class="i-lucide-search pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 text-muted-foreground -translate-y-1/2"
        />
        <Input
          v-model="searchValue"
          type="text"
          class="h-8 border-transparent rounded-lg bg-foreground/5 pl-8 pr-3 text-sm transition-colors focus-visible:border-ring focus-visible:bg-background hover:bg-foreground/8 placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
          :placeholder="t('search.search')"
        />
      </div>

      <div
        ref="containerRef"
        :class="isDraggingTabs ? 'cursor-grabbing select-none' : canDragTabs ? 'cursor-grab' : ''"
        class="no-scrollbar relative flex items-center gap-1 overflow-x-auto px-3 -mx-3"
        @click.capture="handleTabClickCapture"
        @pointercancel="endTabDrag"
        @pointerdown="handleTabPointerDown"
        @pointermove="handleTabPointerMove"
        @pointerup="endTabDrag"
        @wheel="handleTabWheel"
      >
        <div
          aria-hidden="true"
          class="pointer-events-none absolute left-3 top-0 h-7 rounded-md bg-primary transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
          :style="gliderStyle"
        />

        <button
          :ref="(el) => setAllTabRef(el as Element | ComponentPublicInstance | null)"
          :class="[
            activeChatGroup === undefined
              ? 'text-primary-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground',
          ]"
          class="relative z-10 h-7 flex shrink-0 items-center rounded-md px-2.5 text-xs transition-colors duration-200"
          @click="toggleActiveChatGroup(undefined)"
        >
          <span>{{ t('chatGroups.all') }}</span>
        </button>

        <button
          v-for="folder in folders"
          :key="folder.id"
          :ref="(el) => setFolderTabRef(el as Element | ComponentPublicInstance | null, folder.id)"
          :class="[
            activeChatGroup === 'folder' && normalizedSelectedFolderId === folder.id
              ? 'text-primary-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground',
          ]"
          class="relative z-10 h-7 flex shrink-0 items-center rounded-md px-2.5 text-xs transition-colors duration-200"
          @click="selectFolder(folder.id)"
        >
          <span>{{ folder.title }}</span>
        </button>
      </div>

      <div
        v-if="showAIContextHint && aiContextCount === 0"
        class="flex items-center gap-2 border rounded-lg border-dashed px-2.5 py-2 text-xs text-muted-foreground"
      >
        <span class="i-lucide-sparkles h-3.5 w-3.5 shrink-0 text-foreground" />
        <span>{{ t('chatList.aiContextHint') }}</span>
      </div>
    </div>

    <!-- Chat list -->
    <div class="min-h-0 flex-1 overflow-hidden border-t">
      <VList
        v-if="activeGroupChats.length > 0"
        :data="activeGroupChats"
        class="chat-list h-full py-2"
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
                <span class="i-lucide-sparkles mr-2 h-4 w-4" />
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
      <div v-else class="h-full flex flex-col items-center justify-center gap-2 p-4 text-center text-muted-foreground">
        <span class="i-lucide-message-square-dashed h-6 w-6 opacity-50" />
        <p class="text-xs">
          {{ t('chatList.noChatsFound') }}
        </p>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="aiContextCount > 0"
      class="pointer-events-none fixed left-1/2 z-40 w-[min(calc(100vw-1.5rem),26rem)] md:bottom-8 md:left-[calc(var(--app-sidebar-width)+(100vw-var(--app-sidebar-width))/2)] md:w-[min(28rem,calc(100vw-var(--app-sidebar-width)-4rem))] -translate-x-1/2"
      :class="isAIChatDrawerOpen ? 'bottom-32' : 'bottom-20'"
    >
      <div class="pointer-events-auto flex items-center gap-2 border rounded-xl bg-popover p-1.5 pl-3 text-popover-foreground shadow-lg">
        <span class="i-lucide-sparkles h-4 w-4 shrink-0" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium leading-tight">
            {{ t('chatList.aiContextReady') }}
          </p>
          <p class="truncate text-xs text-muted-foreground leading-tight">
            {{ isSelectionMode ? t('chatList.selectionModeCount', { count: aiContextCount }) : t('chatList.aiContextCount', { count: aiContextCount }) }}
          </p>
        </div>

        <button
          class="h-8 inline-flex shrink-0 items-center rounded-lg px-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          @click="clearAIContextChats"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          class="h-8 inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs text-primary-foreground font-medium transition-opacity hover:opacity-90"
          @click="openAIChatWithSelectedChats"
        >
          <span>{{ t('aiChat.aiChat') }}</span>
          <span class="i-lucide-arrow-right h-3.5 w-3.5" />
        </button>
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
