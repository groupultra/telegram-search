<script setup lang="ts">
import type { ChatGroup } from '@tg-search/client'
import type { CoreDialog } from '@tg-search/core/types'
import type { ComponentPublicInstance } from 'vue'

import { useLogger } from '@guiiai/logg'
import { prefillChatAvatarIntoStore, useChatStore, useSettingsStore } from '@tg-search/client'
import { storeToRefs } from 'pinia'
import { VList } from 'virtua/vue'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import EntityAvatar from '../avatar/EntityAvatar.vue'

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

const chats = computed(() => chatStore.chats)
const folders = computed(() => chatStore.folders)
const searchValue = computed({
  get: () => props.searchQuery,
  set: value => emit('update:searchQuery', value),
})

// Filter based on search query
const chatsFiltered = computed(() => {
  const list = chats.value || []
  if (!props.searchQuery)
    return list
  const query = props.searchQuery.toLowerCase()
  return list.filter(chat => (chat?.name || '').toLowerCase().includes(query))
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

// Filtered chats by active group or folder
const activeGroupChats = computed(() => {
  const filtered = chatsFiltered.value || []

  // 1. Handle Folders
  if (activeChatGroup.value === 'folder' && selectedFolderId.value !== undefined) {
    const folder = folders.value.find(f => f?.id === selectedFolderId.value)
    if (folder) {
      const folderChats = filtered.filter((chat) => {
        return chat?.folderIds?.includes(selectedFolderId.value!)
      })

      // For folders, per user request: "don't do pinning for now"
      // Just sort by date
      return [...folderChats].sort((a, b) => {
        const dateA = a?.lastMessageDate ? new Date(a.lastMessageDate).getTime() : 0
        const dateB = b?.lastMessageDate ? new Date(b.lastMessageDate).getTime() : 0
        return dateB - dateA
      })
    }
  }

  // 2. Handle "All Chats"
  // Use global pinning only for non-folder views (especially All Chats)
  return [...filtered].sort((a, b) => {
    if (a?.pinned && !b?.pinned)
      return -1
    if (!a?.pinned && b?.pinned)
      return 1

    const dateA = a?.lastMessageDate ? new Date(a.lastMessageDate).getTime() : 0
    const dateB = b?.lastMessageDate ? new Date(b.lastMessageDate).getTime() : 0
    return dateB - dateA
  })
})

function isChatPinned(chat: CoreDialog) {
  // Only show pin icon in non-folder views
  if (activeChatGroup.value === 'folder')
    return false
  return chat.pinned
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
  else if (activeChatGroup.value === 'folder' && selectedFolderId.value !== undefined) {
    activeEl = allTabs.value.get(`folder-${selectedFolderId.value}`)
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
  [activeChatGroup, selectedFolderId, folders],
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
  <div class="min-h-0 flex flex-1 flex-col">
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
              activeChatGroup === 'folder' && selectedFolderId === folder.id
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
          <div class="group relative">
            <div
              class="i-lucide-search absolute left-3 top-1/2 h-4 w-4 text-muted-foreground transition-colors -translate-y-1/2 group-focus-within:text-primary"
            />
            <Input
              v-model="searchValue"
              type="text"
              class="h-10 border-transparent rounded-xl bg-muted/50 pl-9 transition-all focus:border-primary/20 focus:bg-background hover:bg-muted/80 focus:ring-2 focus:ring-primary/20"
              :placeholder="t('search.search')"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Chat list -->
    <div class="min-h-0 flex-1 overflow-hidden">
      <VList
        v-if="activeGroupChats.length > 0"
        :data="activeGroupChats"
        class="h-full px-2 pb-2"
      >
        <template #default="{ item: chat }">
          <div
            v-if="chat"
            :key="chat.id"
            :class="[
              route.params.id === chat.id.toString()
                ? 'bg-accent/80 text-accent-foreground shadow-sm ring-1 ring-border/50'
                : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
            ]"
            class="group mx-1 mb-1 flex cursor-pointer items-center gap-3 rounded-xl p-2.5 transition-all duration-200"
            @click="router.push(`/chat/${chat.id}`)"
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
                <span
                  v-if="chat.lastMessageDate"
                  class="shrink-0 text-[10px] opacity-60"
                >
                  {{ new Date(chat.lastMessageDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }}
                </span>
              </div>

              <div class="flex items-center justify-between gap-2">
                <span class="truncate text-xs opacity-70">
                  {{ chat.type === 'private' ? t('chatList.privateChat') : (chat.type === 'channel' ? t('chatList.channel') : t('chatList.group')) }}
                </span>
                <span
                  v-if="isChatPinned(chat)"
                  class="i-lucide-pin h-3 w-3 shrink-0 rotate-45 text-primary/60"
                />
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
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
