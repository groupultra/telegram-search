<script setup lang="ts">
import type { CoreDialog, CoreMessage } from '@tg-search/core/types'

import { useChatStore, useMessageStore, useWebsocketStore } from '@tg-search/client'
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
const messageLimit = ref(100) // 增加初始加载量
const messageOffset = ref(0)
const isInitialized = ref(false)

const scrollerRef = ref()

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

// 加载消息的函数
async function loadMessages(offset = 0) {
  if (isLoadingMessages.value)
    return

  isLoadingMessages.value = true
  try {
    await messageStore.fetchMessagesWithDatabase(id.toString(), {
      offset,
      limit: messageLimit.value,
    })
    if (offset > 0) {
      messageOffset.value = offset
    }
  }
  finally {
    isLoadingMessages.value = false
  }
}

onMounted(async () => {
  document.addEventListener('click', handleClickOutside)

  // 初始化时加载更多消息
  await loadMessages(0)

  // 等待 DOM 更新后滚动到底部
  await nextTick()
  if (scrollerRef.value && chatMessages.value.length > 0) {
    // 延迟滚动到底部，确保虚拟滚动器已经初始化
    setTimeout(() => {
      scrollerRef.value?.scrollToBottom()
    }, 100)
  }

  isInitialized.value = true
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

const websocketStore = useWebsocketStore()
const messageInput = ref('')

// 监听新消息，自动滚动到底部
watch(() => chatMessages.value.length, (newLength, oldLength) => {
  if (isInitialized.value && newLength > oldLength) {
    nextTick(() => {
      if (scrollerRef.value) {
        scrollerRef.value.scrollToBottom()
      }
    })
  }
})

// Handle scroll to top for infinite scroll
function handleScroll(event: Event) {
  const target = event.target as HTMLElement
  if (target.scrollTop === 0 && !isLoadingMessages.value) {
    const newOffset = messageOffset.value + messageLimit.value
    loadMessages(newOffset)
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
    <DynamicScroller
      ref="scrollerRef"
      :items="chatMessages"
      :min-item-size="80"
      :buffer="300"
      key-field="uuid"
      class="flex-1 p-4"
      @scroll="handleScroll"
    >
      <template #default="{ item, index, active }">
        <DynamicScrollerItem
          :item="item"
          :active="active"
          :data-index="index"
          :size-dependencies="[item.content, item.media]"
          class="mb-4"
        >
          <MessageBubble :message="item" />
        </DynamicScrollerItem>
      </template>
    </DynamicScroller>

    <!-- Loading indicator -->
    <div v-if="isLoadingMessages" class="absolute left-4 top-20 flex items-center gap-2 rounded bg-blue-100 px-3 py-1 text-sm text-blue-800">
      <div class="i-lucide-loader-2 h-4 w-4 animate-spin" />
      <span>加载消息中...</span>
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

<style>
@import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';
</style>
