<script setup lang="ts">
import type { CoreDialog, CoreMessage } from '@tg-search/core'

import { useScroll, useVirtualList } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'

import GlobalSearch from '../../components/GlobalSearch.vue'
import MessageBubble from '../../components/messages/MessageBubble.vue'
import { useChatStore } from '../../store/useChat'
import { useMessageStore } from '../../store/useMessage'
import { useWebsocketStore } from '../../store/useWebsocket'

// const { ctrl_f, command_f } = useMagicKeys()

const route = useRoute('/chat/:id')
const id = route.params.id

const chatStore = useChatStore()
const messageStore = useMessageStore()
const { messagesByChat } = storeToRefs(messageStore)
const chatMessagesMap = computed<Map<string, CoreMessage>>(() =>
  messagesByChat.value.get(id.toString()) ?? new Map(),
)
const chatMessages = computed<CoreMessage[]>(() =>
  Array.from(chatMessagesMap.value.values())
    .sort((a, b) =>
      a.platformTimestamp <= b.platformTimestamp ? -1 : 1,
    ),
)
const currentChat = computed<CoreDialog | undefined>(() =>
  chatStore.getChat(id.toString()),
)
const isGlobalSearch = ref(false)
const globalSearchRef = ref<InstanceType<typeof GlobalSearch> | null>(null)
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

// function toggleGlobalSearch() {
//   isGlobalSearch.value = !isGlobalSearch.value
//   if (isGlobalSearch.value) {
//     nextTick(() => {
//       globalSearchRef.value?.focus()
//     })
//   }
// }

function handleClickOutside(event: MouseEvent) {
  if (isGlobalSearch.value && globalSearchRef.value) {
    const target = event.target as HTMLElement
    const searchElement = globalSearchRef.value.$el as HTMLElement
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

// watch(ctrl_f, () => {
//   if (ctrl_f.value) {
//     toggleGlobalSearch()
//   }
// })

// watch(command_f, () => {
//   if (command_f.value) {
//     toggleGlobalSearch()
//   }
// })

const websocketStore = useWebsocketStore()

const messageInput = ref('')
const { y } = useScroll(containerProps.ref)
const lastMessagePosition = ref(0)

watch(chatMessages, () => {
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
  <div class="h-full flex flex-col relative">
    <!-- Chat Header -->
    <div class="p-4 border-b dark:border-gray-700 flex items-center justify-between">
      <h2 class="text-xl font-semibold dark:text-gray-100">
        {{ currentChat?.name }} | {{ currentChat?.id }}
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
    <div class="border-t dark:border-gray-700 p-4">
      <div class="flex gap-2">
        <input
          v-model="messageInput"
          type="text"
          placeholder="Type a message..."
          class="flex-1 rounded-lg border dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 p-2"
          @keyup.enter="sendMessage"
        >
        <button
          class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          @click="sendMessage"
        >
          Send
        </button>
      </div>
    </div>

    <Teleport to="body">
      <GlobalSearch
        ref="globalSearchRef"
        v-model:open="isGlobalSearchOpen"
        :chat-id="id.toString()"
        class="absolute top-[20%] left-0 w-full"
      >
        <template #settings>
          <div class="flex items-center">
            <input id="searchContent" type="checkbox" class="rounded border-border mr-1">
            <label for="searchContent" class="text-sm text-foreground">搜索内容</label>
          </div>
        </template>
      </GlobalSearch>
    </Teleport>
  </div>
</template>
