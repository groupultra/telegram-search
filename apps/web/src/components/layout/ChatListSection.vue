<script setup lang="ts">
import type { ChatGroup } from '@tg-search/client'
import type { CoreDialog } from '@tg-search/core/types'

import { useLogger } from '@guiiai/logg'
import { prefillChatAvatarIntoStore, useChatStore, useSettingsStore } from '@tg-search/client'
import { storeToRefs } from 'pinia'
import { VList } from 'virtua/vue'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import EntityAvatar from '../avatar/EntityAvatar.vue'

const props = defineProps<{
  searchQuery: string
}>()

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const chatStore = useChatStore()
const settingsStore = useSettingsStore()
const { selectedGroup, selectedFolderId } = storeToRefs(settingsStore)

const chats = computed(() => chatStore.chats)
const folders = computed(() => chatStore.folders)

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
</script>

<template>
  <div class="min-h-0 flex flex-1 flex-col border-t">
    <!-- Folder/Tab selector -->
    <div class="flex flex-col border-b">
      <div
        class="no-scrollbar flex items-center gap-2 overflow-x-auto px-2 py-2"
      >
        <!-- All Chats (Special Folder) -->
        <button
          :class="{ 'bg-accent text-accent-foreground': activeChatGroup === undefined }"
          class="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          @click="toggleActiveChatGroup(undefined)"
        >
          <span class="i-lucide-layers h-4 w-4" />
          <span>{{ t('chatGroups.all') }}</span>
        </button>

        <!-- Dynamic Folders -->
        <button
          v-for="folder in folders"
          :key="folder.id"
          :class="{ 'bg-accent text-accent-foreground': activeChatGroup === 'folder' && selectedFolderId === folder.id }"
          class="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          @click="selectFolder(folder.id)"
        >
          <span>{{ folder.title }}</span>
        </button>
      </div>
    </div>

    <!-- Chat list -->
    <div class="min-h-0 flex-1 overflow-hidden">
      <VList
        v-if="activeGroupChats.length > 0"
        :data="activeGroupChats"
        class="h-full py-2"
      >
        <template #default="{ item: chat }">
          <div
            v-if="chat"
            :key="chat.id"
            :class="{ 'bg-accent text-accent-foreground': route.params.id === chat.id.toString() }"
            class="mx-2 my-0.5 flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 transition-colors hover:bg-accent hover:text-accent-foreground"
            @click="router.push(`/chat/${chat.id}`)"
          >
            <EntityAvatar
              :id="chat.id"
              entity="other"
              entity-type="chat"
              :file-id="chat.avatarFileId"
              :name="chat.name"
              size="sm"
            />
            <div class="min-w-0 flex flex-1 flex-col">
              <div class="flex items-center gap-1.5">
                <span class="truncate text-sm font-medium">
                  {{ chat.name }}
                </span>
                <span
                  v-if="isChatPinned(chat)"
                  class="i-lucide-pin h-3 w-3 shrink-0 rotate-45 text-muted-foreground/60"
                />
              </div>
              <span class="truncate text-xs text-muted-foreground">
                {{ chat.id }}
              </span>
            </div>
          </div>
        </template>
      </VList>
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
