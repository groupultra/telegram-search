<script setup lang="ts">
import type { TelegramMessage } from '@tg-search/core'
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessages } from '../../apis/useMessages'

// Local message type with highlight support
interface LocalMessage extends TelegramMessage {
  highlight?: boolean
}

// Initialize API client and router
const { messages: apiMessages, loading: messagesLoading, chat, total: messagesTotal, loadMessages: fetchMessages, error } = useMessages()
const route = useRoute()
const router = useRouter()
const messages = ref<LocalMessage[]>([])
const total = ref(0)
const chatTitle = ref('')

// Pagination
const pageSize = 50
const currentPage = ref(1)
const totalPages = computed(() => Math.ceil(total.value / pageSize))
const hasMore = computed(() => currentPage.value < totalPages.value)
const loadingMore = ref(false)

// Get chat ID from route
const chatId = Number(route.params.id)

// Message container ref for scroll handling
const messageContainer = ref<HTMLElement>()

// Current user ID (TODO: Get from auth)
const currentUserId = ref(123456789)

// Navigate to search page
function handleSearch() {
  router.push({
    path: '/search',
    query: { chatId },
  })
}

// Load messages from chat
async function loadMessages(page = 1, append = false) {
  loadingMore.value = true
  try {
    const offset = (page - 1) * pageSize
    await fetchMessages(chatId, {
      limit: pageSize,
      offset,
    })
    chatTitle.value = chat.value?.title || ''

    if (apiMessages.value) {
      // Get current scroll position
      const scrollPos = messageContainer.value?.scrollHeight || 0
      if (append) {
        // Add older messages to the beginning (since they're in reverse order)
        messages.value.unshift(...apiMessages.value)
      }
      else {
        messages.value = [...apiMessages.value].reverse()
      }
      total.value = messagesTotal.value
      currentPage.value = page

      // Restore scroll position after appending messages
      if (append) {
        await nextTick()
        const newScrollPos = messageContainer.value?.scrollHeight || 0
        messageContainer.value?.scrollTo({
          top: newScrollPos - scrollPos,
          behavior: 'instant',
        })
      }
      else {
        // Scroll to bottom for initial load
        await nextTick()
        messageContainer.value?.scrollTo({
          top: messageContainer.value.scrollHeight,
          behavior: 'instant',
        })
      }
    }
  }
  finally {
    loadingMore.value = false
  }
}

// Handle scroll to load more
async function onScroll(e: Event) {
  const target = e.target as HTMLElement
  const { scrollTop } = target
  const threshold = 100 // px from top

  if (
    !loadingMore.value
    && hasMore.value
    && scrollTop < threshold
  ) {
    await loadMessages(currentPage.value + 1, true)
  }
}

// Jump to message by ID
async function jumpToMessage(messageId: number) {
  // Find message in current list
  const targetMessage = messages.value.find(m => m.id === messageId)
  if (targetMessage) {
    // Message is in current list, scroll to it
    const messageElement = document.getElementById(`message-${messageId}`)
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Highlight message temporarily
      targetMessage.highlight = true
      setTimeout(() => {
        targetMessage.highlight = false
      }, 2000)
    }
    return
  }

  // Message not in current list, load it
  try {
    // Try to load messages until we find the target message
    let offset = 0
    let found = false
    while (!found) {
      await fetchMessages(chatId, {
        limit: pageSize,
        offset,
      })

      if (!apiMessages.value || apiMessages.value.length === 0) {
        break
      }

      messages.value = [...apiMessages.value].reverse()
      total.value = messagesTotal.value
      currentPage.value = Math.floor(offset / pageSize) + 1

      // Check if target message is in this batch
      const targetMessage = messages.value.find(m => m.id === messageId)
      if (targetMessage) {
        found = true
        await nextTick()
        const messageElement = document.getElementById(`message-${messageId}`)
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
          // Highlight message temporarily
          targetMessage.highlight = true
          setTimeout(() => {
            targetMessage.highlight = false
          }, 2000)
        }
        break
      }

      // If not found and there are more messages, try next batch
      if (offset + pageSize < messagesTotal.value) {
        offset += pageSize
      }
      else {
        break
      }
    }

    if (!found) {
      console.warn(`Message ${messageId} not found`)
    }
  }
  catch (error) {
    console.error(error)
  }
}

// Load messages on mount
onMounted(async () => {
  if (Number.isNaN(chatId)) {
    router.push('/')
    return
  }
  await loadMessages()

  // Handle hash change for message jumping
  const hash = window.location.hash
  if (hash.startsWith('#message-')) {
    const messageId = Number(hash.slice('#message-'.length))
    if (!Number.isNaN(messageId)) {
      await jumpToMessage(messageId)
    }
  }

  // Listen for hash changes
  window.addEventListener('hashchange', async () => {
    const hash = window.location.hash
    if (hash.startsWith('#message-')) {
      const messageId = Number(hash.slice('#message-'.length))
      if (!Number.isNaN(messageId)) {
        await jumpToMessage(messageId)
      }
    }
  })
})
</script>

<template>
  <div class="h-screen flex flex-col">
    <!-- Chat header -->
    <div class="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2 transition-colors duration-300 dark:border-gray-800 dark:bg-gray-900">
      <div class="flex items-center gap-2">
        <button
          class="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
          @click="router.back()"
        >
          <div class="i-lucide-arrow-left h-5 w-5 dark:text-white" />
        </button>
        <h1 class="text-lg font-semibold dark:text-white">
          {{ chatTitle }}
          <span class="ml-2 text-xs text-gray-500 font-normal">ID: {{ chatId }}</span>
        </h1>
      </div>

      <div class="flex items-center gap-2">
        <button
          class="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
          @click="handleSearch"
        >
          <div class="i-lucide-search h-5 w-5 dark:text-white" />
        </button>
      </div>
    </div>

    <!-- Chat messages -->
    <div
      ref="messageContainer"
      class="flex-1 overflow-y-auto bg-gray-50 p-4 transition-colors duration-300 space-y-4 dark:bg-gray-900"
      @scroll="onScroll"
    >
      <!-- Loading state -->
      <div v-if="messagesLoading" class="text-center text-gray-500 dark:text-gray-400">
        Loading messages...
      </div>
      <div v-else-if="error" class="text-center text-red-500 dark:text-red-400">
        {{ error }}
      </div>
      <!-- Messages -->
      <template v-else>
        <MessageBubble
          v-for="message in messages"
          :id="`message-${message.id}`"
          :key="message.id"
          :message="message"
          :is-self="message.fromId === currentUserId"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
/* Hide scrollbar for Chrome, Safari and Opera */
.overflow-y-auto::-webkit-scrollbar {
  display: none;
}

/* Hide scrollbar for IE, Edge and Firefox */
.overflow-y-auto {
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}
</style>
