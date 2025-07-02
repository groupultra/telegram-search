<script setup lang="ts">
import type { CoreDialog, CoreMessage } from '@tg-search/core/types'

import { useChatStore, useMessageStore, useWebsocketStore } from '@tg-search/client'
import { useScroll, useVirtualList } from '@vueuse/core'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'

import MessageBubble from '../../components/messages/MessageBubble.vue'
import SearchDialog from '../../components/SearchDialog.vue'
import { Button } from '../../components/ui/Button'

const route = useRoute('/chat/:id')
const id = route.params.id

const chatStore = useChatStore()
const messageStore = useMessageStore()
const chatMessages = computed<CoreMessage[]>(() =>
  Array.from(messageStore.useMessageChatMap(id.toString()).values())
    .sort((a, b) =>
      a.platformTimestamp - b.platformTimestamp,
    ),
)
const currentChat = computed<CoreDialog | undefined>(() =>
  chatStore.getChat(id.toString()),
)

const isGlobalSearch = ref(false)
const searchDialogRef = ref<InstanceType<typeof SearchDialog> | null>(null)
const isLoadingMessages = ref(false)
const messageLimit = ref(50)
const messageOffset = ref(0)

const { list, containerProps, wrapperProps } = useVirtualList(
  chatMessages,
  {
    itemHeight: () => 80, // Estimated height for message bubble
    // overscan: 10,
  },
)

function handleClickOutside(event: MouseEvent) {
  if (isGlobalSearch.value && searchDialogRef.value) {
    const target = event.target as HTMLElement
    const searchElement = searchDialogRef.value.$el as HTMLElement
    const searchButton = document.querySelector('[data-search-button]') as HTMLElement
    if (!searchElement.contains(target) && !searchButton?.contains(target)) {
      isGlobalSearch.value = false
    }
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

const websocketStore = useWebsocketStore()

const messageInput = ref('')
const { y } = useScroll(containerProps.ref)
const lastMessagePosition = ref(0)

watch(() => chatMessages.value.length, () => {
  lastMessagePosition.value = containerProps.ref.value?.scrollHeight ?? 0

  nextTick(() => {
    y.value = (containerProps.ref.value?.scrollHeight ?? 0) - lastMessagePosition.value
    messageOffset.value += messageLimit.value
  })
})

// TODO: useInfiniteScroll?
watch(y, async () => {
  if (y.value === 0 && !isLoadingMessages.value) {
    isLoadingMessages.value = true

    await messageStore.fetchMessagesWithDatabase(id.toString(), { offset: messageOffset.value, limit: messageLimit.value })

    isLoadingMessages.value = false
  }
}, { immediate: true })

function sendMessage() {
  if (!messageInput.value.trim())
    return

  websocketStore.sendEvent('message:send', {
    chatId: id.toString(),
    content: messageInput.value,
  })
  messageInput.value = ''

  toast.success('Message sent')
}

const isGlobalSearchOpen = ref(false)
</script>

<template>
  <div class="relative h-full flex flex-col">
    <!-- Chat Header -->
    <div class="flex items-center justify-between border-b p-4 dark:border-gray-700">
      <h2 class="text-xl font-semibold dark:text-gray-100">
        {{ [currentChat?.name, currentChat?.id].filter(Boolean).join('@') }}
      </h2>
      <Button
        icon="i-lucide-search"
        data-search-button
        @click="isGlobalSearchOpen = !isGlobalSearchOpen"
      >
        Search
      </Button>
    </div>

    <!-- Messages Area -->
    <div
      v-bind="containerProps"
      class="flex-1 overflow-y-auto p-4 space-y-4"
    >
      <div v-bind="wrapperProps">
        <div v-for="{ data, index } in list" :key="index">
          <MessageBubble :message="data" />
        </div>
      </div>
    </div>

    <!-- Message Input -->
    <div class="border-t p-4 dark:border-gray-700">
      <div class="flex gap-2">
        <input
          v-model="messageInput"
          type="text"
          placeholder="Type a message..."
          class="flex-1 border rounded-lg p-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          @keyup.enter="sendMessage"
        >
        <button
          class="rounded-lg bg-blue-500 px-4 py-2 text-white transition-colors hover:bg-blue-600"
          @click="sendMessage"
        >
          Send
        </button>
      </div>
    </div>

    <Teleport to="body">
      <SearchDialog
        ref="searchDialogRef"
        v-model:open="isGlobalSearchOpen"
        :chat-id="id.toString()"
        class="absolute left-0 top-[20%] w-full"
      >
        <template #settings>
          <div class="flex items-center">
            <input id="searchContent" type="checkbox" class="mr-1 border-border rounded">
            <label for="searchContent" class="text-sm text-primary-900">搜索内容</label>
          </div>
        </template>
      </SearchDialog>
    </Teleport>
  </div>
</template>
