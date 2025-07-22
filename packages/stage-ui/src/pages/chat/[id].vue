<script setup lang="ts">
import type { CoreDialog } from '@tg-search/core/types'

import { useChatStore, useMessageStore, useWebsocketStore } from '@tg-search/client'
import { useWindowSize } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'

import MessageBubble from '../../components/messages/MessageBubble.vue'
import SearchDialog from '../../components/SearchDialog.vue'
import { Button } from '../../components/ui/Button'

const route = useRoute('/chat/:id')
const id = route.params.id

const chatStore = useChatStore()
const messageStore = useMessageStore()
const websocketStore = useWebsocketStore()

const { sortedMessageIds, messageWindow, sortedMessageArray } = storeToRefs(messageStore)
const currentChat = computed<CoreDialog | undefined>(() => chatStore.getChat(id.toString()))

const messageLimit = ref(20)
const messageOffset = ref(0)
const { isLoading: isLoadingMessages, fetchMessages } = messageStore.useFetchMessages(id.toString(), messageLimit.value)

const { height: windowHeight } = useWindowSize()

const isLoadingOlder = ref(false)
const isLoadingNewer = ref(false)

const searchDialogRef = ref<InstanceType<typeof SearchDialog> | null>(null)
const isGlobalSearchOpen = ref(false)

const messageInput = ref('')

// Initial load when component mounts
onMounted(async () => {
  // Only load if there are no messages yet
  if (sortedMessageIds.value.length === 0) {
    await loadOlderMessages()
  }
})

// Load older messages when scrolling to top
async function loadOlderMessages() {
  if (isLoadingOlder.value || isLoadingMessages.value)
    return

  isLoadingOlder.value = true

  try {
    fetchMessages({
      offset: messageOffset.value,
      limit: messageLimit.value,
    }, 'older')
    messageOffset.value += messageLimit.value
  }
  finally {
    isLoadingOlder.value = false
  }
}

// Load newer messages when scrolling to bottom
async function loadNewerMessages() {
  if (isLoadingNewer.value || isLoadingMessages.value)
    return

  // Get the current max message ID to fetch messages after it
  const currentMaxId = messageWindow.value?.maxId
  if (!currentMaxId || currentMaxId === -Infinity) {
    // eslint-disable-next-line no-console
    console.log('No messages loaded yet, cannot fetch newer messages')
    return
  }

  isLoadingNewer.value = true

  try {
    // Use a separate fetch function for newer messages with minId
    fetchMessages(
      {
        offset: 0,
        limit: messageLimit.value,
        minId: currentMaxId,
      },
      'newer',
    )
  }
  finally {
    isLoadingNewer.value = false
  }
}

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
</script>

<template>
  <div class="relative h-full flex flex-col">
    <!-- Debug Panel -->
    <div class="absolute right-4 top-24 w-1/4 flex flex-col justify-left gap-2 rounded-lg bg-neutral-200 p-2 text-sm text-gray-500 font-mono dark:bg-neutral-800">
      <span>
        Height: {{ windowHeight }} / Messages: {{ sortedMessageArray.length }}
      </span>
      <span>
        IDs: {{ sortedMessageIds[0] }} - {{ sortedMessageIds[sortedMessageIds.length - 1] }}
      </span>
      <span>
        MinId: {{ messageWindow?.minId }} / MaxId: {{ messageWindow?.maxId }}
      </span>
      <span>
        Loading: {{ isLoadingMessages }} / Older: {{ isLoadingOlder }} / Newer: {{ isLoadingNewer }}
      </span>
      <span>
        Offset: {{ messageOffset }}
      </span>
      <button
        class="rounded bg-blue-500 px-2 py-1 text-xs text-white"
        :disabled="isLoadingOlder || isLoadingMessages"
        @click="loadOlderMessages"
      >
        Force Load Older
      </button>
      <button
        class="rounded bg-green-500 px-2 py-1 text-xs text-white"
        :disabled="isLoadingNewer || isLoadingMessages"
        @click="loadNewerMessages"
      >
        Force Load Newer
      </button>
    </div>

    <!-- Chat Header -->
    <div class="flex items-center justify-between border-b p-4 dark:border-gray-700">
      <h2 class="text-xl text-gray-900 font-semibold dark:text-gray-100">
        {{ [currentChat?.name, currentChat?.id].filter(Boolean).join(' @ ') }}
      </h2>
      <Button
        icon="i-lucide-search"
        data-search-button
        @click="isGlobalSearchOpen = !isGlobalSearchOpen"
      >
        Search
      </Button>
    </div>

    <div class="flex-1 overflow-auto bg-white p-4 dark:bg-gray-900">
      <template v-for="message in sortedMessageArray">
        <MessageBubble v-if="message" :key="message.uuid" :message="message" />
      </template>
    </div>

    <!-- Message Input -->
    <div class="border-t bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div class="flex gap-2">
        <input
          v-model="messageInput"
          type="text"
          placeholder="Type a message..."
          class="flex-1 border border-gray-300 rounded-lg bg-white p-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary dark:placeholder:text-gray-400 dark:focus:ring-offset-gray-800"
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
            <label for="searchContent" class="text-sm text-primary-900 dark:text-gray-100">搜索内容</label>
          </div>
        </template>
      </SearchDialog>
    </Teleport>
  </div>
</template>
