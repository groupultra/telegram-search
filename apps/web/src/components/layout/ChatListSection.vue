<script setup lang="ts">
import type { ChatGroup } from '@tg-search/client'
import type { CoreDialog } from '@tg-search/core/types'
import type { ComponentPublicInstance } from 'vue'

import { useLogger } from '@guiiai/logg'
import { prefillChatAvatarIntoStore, useChatStore, useSettingsStore } from '@tg-search/client'
import { useMediaQuery } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { VList } from 'virtua/vue'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import EntityAvatar from '../avatar/EntityAvatar.vue'

import { useChatListSelection } from '../../composables/use-chat-list-selection'
import { filterChatsByQuery, formatChatTimestamp, getChatPreview, matchesFolder, sortChatsForFolder } from '../../utils/chat-list'
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

function updateGlider() {
  if (!containerRef.value)
    return

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
</script>

<template>
  <div class="relative min-h-0 flex flex-1 flex-col">
    <div class="sticky top-0 z-10 bg-background/80 backdrop-blur-sm">
      <div class="flex flex-col">
        <div
          ref="containerRef"
          class="no-scrollbar relative flex items-center gap-2 overflow-x-auto px-3 py-2"
        >
          <div
            aria-hidden="true"
            class="pointer-events-none absolute left-3 top-2 h-8 rounded-full bg-primary shadow-sm transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
            :style="gliderStyle"
          />

          <button
            :ref="(el) => setAllTabRef(el as Element | ComponentPublicInstance | null)"
            :class="[
              activeChatGroup === undefined
                ? 'text-primary-foreground font-semibold'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            ]"
            class="relative z-10 h-8 flex shrink-0 items-center gap-2 rounded-full px-4 text-xs transition-colors duration-200"
            @click="toggleActiveChatGroup(undefined)"
          >
            <span class="i-lucide-layers h-3.5 w-3.5" />
            <span>{{ t('chatGroups.all') }}</span>
          </button>

          <button
            v-for="folder in folders"
            :key="folder.id"
            :ref="(el) => setFolderTabRef(el as Element | ComponentPublicInstance | null, folder.id)"
            :class="[
              activeChatGroup === 'folder' && normalizedSelectedFolderId === folder.id
                ? 'text-primary-foreground font-semibold'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            ]"
            class="relative z-10 h-8 flex shrink-0 items-center gap-2 rounded-full px-4 text-xs transition-colors duration-200"
            @click="selectFolder(folder.id)"
          >
            <span>{{ folder.title }}</span>
          </button>
        </div>

        <div class="px-3 pb-2">
          <div class="relative">
            <div
              class="i-lucide-search absolute left-3 top-1/2 h-4 w-4 text-muted-foreground transition-colors -translate-y-1/2"
            />
            <Input
              v-model="searchValue"
              type="text"
              class="h-10 border-border/60 rounded-xl bg-background/80 pl-9 pr-4 text-foreground shadow-sm transition-all focus:border-primary/35 hover:border-border focus:bg-background hover:bg-background placeholder:text-foreground/45 focus:ring-2 focus:ring-primary/15"
              :placeholder="t('search.search')"
            />
          </div>

          <div
            v-if="showAIContextHint && aiContextCount === 0"
            class="mx-3 mb-2 mt-2 flex items-center gap-2 border border-primary/25 rounded-xl border-dashed bg-primary/5 px-3 py-2 text-xs text-muted-foreground"
          >
            <span class="i-lucide-sparkles h-3.5 w-3.5 shrink-0 text-primary" />
            <span>{{ t('chatList.aiContextHint') }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Chat list -->
    <div class="min-h-0 flex-1 overflow-hidden">
      <VList
        v-if="activeGroupChats.length > 0"
        :data="activeGroupChats"
        class="chat-list h-full px-2 pb-2 pt-1.5"
      >
        <template #default="{ item: chat }">
          <ContextMenu v-if="chat && !isCoarsePointer">
            <ContextMenuTrigger as-child>
              <div
                :key="chat.id"
                :class="[
                  isChatInAIContext(chat.id)
                    ? 'bg-primary/8 text-foreground ring-1 ring-primary/20'
                    : '',
                  $route.params.id === chat.id.toString()
                    ? 'bg-accent/80 text-accent-foreground shadow-sm ring-1 ring-border/50'
                    : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                ]"
                class="group mx-1 mb-1 flex cursor-pointer items-center gap-3 overflow-hidden rounded-xl p-2.5 transition-all duration-200"
                @pointerdown="startLongPress(chat.id)"
                @pointerup="cancelLongPress"
                @pointerleave="cancelLongPress"
                @pointercancel="cancelLongPress"
                @click="handleChatClick(chat.id)"
              >
                <EntityAvatar
                  :id="chat.id"
                  entity="other"
                  entity-type="chat"
                  :file-id="chat.avatarFileId"
                  :name="chat.name"
                  size="md"
                  class="shrink-0 shadow-sm transition-transform duration-200 group-hover:scale-105"
                />
                <div class="min-w-0 flex flex-1 flex-col gap-0.5">
                  <div class="flex items-center justify-between gap-2">
                    <span class="truncate text-sm text-foreground font-semibold">
                      {{ chat.name }}
                    </span>
                  </div>

                  <div
                    v-if="chatPreviews.get(chat.id)?.text"
                    class="truncate text-xs opacity-70"
                  >
                    <span
                      v-if="chatPreviews.get(chat.id)?.sender"
                      class="text-sky-400 font-semibold"
                    >
                      {{ chatPreviews.get(chat.id)?.sender }}:
                    </span>
                    <span>{{ chatPreviews.get(chat.id)?.text }}</span>
                  </div>
                </div>

                <div class="ml-auto w-14 flex shrink-0 flex-col items-end justify-between gap-1 text-right md:w-16">
                  <span
                    v-if="chat.lastMessageDate"
                    class="shrink-0 text-[10px] leading-none opacity-60"
                  >
                    {{ formatChatTimestamp(chat.lastMessageDate) }}
                  </span>

                  <span
                    v-if="!isSelectionMode && (chat.unreadCount ?? 0) > 0"
                    class="h-5 min-w-5 inline-flex items-center justify-center rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground font-semibold leading-none shadow-sm"
                  >
                    {{ chat.unreadCount! > 99 ? '99+' : chat.unreadCount }}
                  </span>

                  <span
                    v-else-if="isChatPinned(chat) && !isSelectionMode"
                    class="i-lucide-pin h-3.5 w-3.5 rotate-45 text-primary/60"
                  />

                  <div
                    v-if="isSelectionMode"
                    class="h-5 w-5 flex items-center justify-center border rounded-md transition-colors"
                    :class="isChatInAIContext(chat.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-border/70 text-transparent'"
                  >
                    <span class="i-lucide-check h-3 w-3" />
                  </div>
                </div>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent class="min-w-[180px]">
              <ContextMenuItem @select="handleDesktopAddToAI(chat.id)">
                <span class="i-lucide-sparkles mr-2 h-4 w-4" />
                {{ t('chatList.addToAIContext') }}
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>

          <div
            v-else-if="chat"
            :key="chat.id"
            :class="[
              isChatInAIContext(chat.id)
                ? 'bg-primary/8 text-foreground ring-1 ring-primary/20'
                : '',
              $route.params.id === chat.id.toString()
                ? 'bg-accent/80 text-accent-foreground shadow-sm ring-1 ring-border/50'
                : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
            ]"
            class="group mx-1 mb-1 flex cursor-pointer items-center gap-3 overflow-hidden rounded-xl p-2.5 transition-all duration-200"
            @pointerdown="startLongPress(chat.id)"
            @pointerup="cancelLongPress"
            @pointerleave="cancelLongPress"
            @pointercancel="cancelLongPress"
            @contextmenu.prevent
            @click="handleChatClick(chat.id)"
          >
            <EntityAvatar
              :id="chat.id"
              entity="other"
              entity-type="chat"
              :file-id="chat.avatarFileId"
              :name="chat.name"
              size="md"
              class="shrink-0 shadow-sm transition-transform duration-200 group-hover:scale-105"
            />
            <div class="min-w-0 flex flex-1 flex-col gap-0.5">
              <div class="flex items-center justify-between gap-2">
                <span class="truncate text-sm text-foreground font-semibold">
                  {{ chat.name }}
                </span>
              </div>

              <div
                v-if="chatPreviews.get(chat.id)?.text"
                class="truncate text-xs opacity-70"
              >
                <span
                  v-if="chatPreviews.get(chat.id)?.sender"
                  class="text-sky-400 font-semibold"
                >
                  {{ chatPreviews.get(chat.id)?.sender }}:
                </span>
                <span>{{ chatPreviews.get(chat.id)?.text }}</span>
              </div>
            </div>

            <div class="ml-auto w-14 flex shrink-0 flex-col items-end justify-between gap-1 text-right md:w-16">
              <span
                v-if="chat.lastMessageDate"
                class="shrink-0 text-[10px] leading-none opacity-60"
              >
                {{ formatChatTimestamp(chat.lastMessageDate) }}
              </span>

              <span
                v-if="!isSelectionMode && (chat.unreadCount ?? 0) > 0"
                class="h-5 min-w-5 inline-flex items-center justify-center rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground font-semibold leading-none shadow-sm"
              >
                {{ chat.unreadCount! > 99 ? '99+' : chat.unreadCount }}
              </span>

              <span
                v-else-if="isChatPinned(chat) && !isSelectionMode"
                class="i-lucide-pin h-3.5 w-3.5 rotate-45 text-primary/60"
              />

              <div
                v-if="isSelectionMode"
                class="h-5 w-5 flex items-center justify-center border rounded-md transition-colors"
                :class="isChatInAIContext(chat.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-border/70 text-transparent'"
              >
                <span class="i-lucide-check h-3 w-3" />
              </div>
            </div>
          </div>
        </template>
      </VList>

      <!-- Empty State -->
      <div v-else class="h-full flex flex-col items-center justify-center p-4 text-center text-muted-foreground">
        <div class="mb-3 rounded-full bg-muted/50 p-4">
          <span class="i-lucide-message-square-off h-8 w-8 opacity-50" />
        </div>
        <p class="text-sm font-medium">
          {{ t('chatList.noChatsFound') }}
        </p>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="aiContextCount > 0"
      class="pointer-events-none fixed left-1/2 z-40 w-[min(calc(100vw-1.5rem),26rem)] md:bottom-8 md:left-[calc(20rem+(100vw-20rem)/2)] md:w-[min(30rem,calc(100vw-24rem))] -translate-x-1/2"
      :class="isAIChatDrawerOpen ? 'bottom-32' : 'bottom-24'"
    >
      <div class="pointer-events-auto flex items-center gap-2 border border-primary/20 rounded-2xl bg-card/95 p-2 shadow-lg backdrop-blur-sm">
        <div class="min-w-0 flex flex-1 items-center gap-2 px-1">
          <div class="h-9 w-9 flex shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <span class="i-lucide-message-square-text h-4 w-4" />
          </div>
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold">
              {{ t('chatList.aiContextReady') }}
            </p>
            <p class="truncate text-xs text-muted-foreground">
              {{ isSelectionMode ? t('chatList.selectionModeCount', { count: aiContextCount }) : t('chatList.aiContextCount', { count: aiContextCount }) }}
            </p>
          </div>
        </div>

        <button
          class="h-9 inline-flex shrink-0 items-center rounded-xl px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          @click="clearAIContextChats"
        >
          {{ t('common.cancel') }}
        </button>
        <button
          class="h-9 inline-flex shrink-0 items-center gap-1 rounded-xl bg-primary px-3 text-xs text-primary-foreground transition-opacity hover:opacity-90"
          @click="openAIChatWithSelectedChats"
        >
          <span class="i-lucide-sparkles h-3.5 w-3.5" />
          <span>{{ t('aiChat.aiChat') }}</span>
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.chat-list {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.chat-list::-webkit-scrollbar {
  display: none;
}

.chat-list :deep(*) {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.chat-list :deep(div::-webkit-scrollbar) {
  display: none;
}

.chat-list :deep(.group) {
  -webkit-touch-callout: none;
  user-select: none;
}
</style>
