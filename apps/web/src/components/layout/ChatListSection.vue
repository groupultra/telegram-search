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
const { selectedGroup } = storeToRefs(useSettingsStore())

const chats = computed(() => chatStore.chats)

// Filter based on search query
const chatsFiltered = computed(() => {
  if (!props.searchQuery)
    return chats.value
  return chats.value.filter(chat => chat.name.toLowerCase().includes(props.searchQuery.toLowerCase()))
})

// Determine active group based on route or selection
const activeChatGroup = computed(() => {
  if (route.params.chatId) {
    const currentChat = chatStore.getChat(route.params.chatId.toString())
    if (currentChat) {
      return currentChat.type
    }
  }
  return selectedGroup.value
})

// Filtered chats by active group
const activeGroupChats = computed(() => {
  return chatsFiltered.value.filter(chat => chat.type === activeChatGroup.value)
})

function toggleActiveChatGroup(group: ChatGroup) {
  selectedGroup.value = group
}

/**
 * Prefill chat avatars from persistent cache in parallel.
 * - Avoids sequential IndexedDB waits when chat list is large.
 * - Only warms cache; network fetch continues to be driven by server events.
 */
async function prefillChatAvatarsParallel(list: CoreDialog[]) {
  const tasks = list.map(chat => prefillChatAvatarIntoStore(chat.id))
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
    <!-- Tab selector -->
    <div class="flex items-center gap-1 border-b p-2">
      <button
        :class="{ 'bg-accent text-accent-foreground': activeChatGroup === 'user' }"
        class="flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
        @click="toggleActiveChatGroup('user')"
      >
        <span class="i-lucide-user h-4 w-4" />
        <span>{{ t('chatGroups.user') }}</span>
      </button>

      <button
        :class="{ 'bg-accent text-accent-foreground': activeChatGroup === 'group' }"
        class="flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
        @click="toggleActiveChatGroup('group')"
      >
        <span class="i-lucide-users h-4 w-4" />
        <span>{{ t('chatGroups.group') }}</span>
      </button>

      <button
        :class="{ 'bg-accent text-accent-foreground': activeChatGroup === 'channel' }"
        class="flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
        @click="toggleActiveChatGroup('channel')"
      >
        <span class="i-lucide-message-circle h-4 w-4" />
        <span>{{ t('chatGroups.channel') }}</span>
      </button>
    </div>

    <!-- Chat list -->
    <div class="min-h-0 flex-1 overflow-hidden">
      <VList
        :data="activeGroupChats"
        class="h-full py-2"
      >
        <template #default="{ item: chat }">
          <div
            :key="chat.id"
            :class="{ 'bg-accent text-accent-foreground': route.params.chatId === chat.id.toString() }"
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
                  v-if="chat.pinned"
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
