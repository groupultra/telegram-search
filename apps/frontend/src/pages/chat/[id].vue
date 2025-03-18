<script setup lang="ts">
import type { TelegramMessage } from '@tg-search/core'
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { useMessages } from '../../apis/useMessages'
import { useUserInfo } from '../../apis/useUserInfo'
// Local message type with highlight support
interface LocalMessage extends TelegramMessage {
  highlight?: boolean
}

// Initialize API client and router
const { messages: apiMessages, loading: messagesLoading, chat, total: messagesTotal, loadMessages: fetchMessages, error, sendMessage } = useMessages()
const { getUserInfo } = useUserInfo()
const route = useRoute()
const router = useRouter()
const messages = ref<LocalMessage[]>([])
const total = ref(0)
const chatTitle = ref('')
const { t } = useI18n()

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

// Context menu state
const showContextMenu = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const selectedMessage = ref<LocalMessage | null>(null)

// Reply dialog state
const showReplyDialog = ref(false)
const replyContent = ref('')

// Navigate to search page
function handleSearch() {
  router.push({
    path: '/search',
    query: { chatId },
  })
}

// Show context menu on right click
function handleContextMenu(event: MouseEvent, message: LocalMessage) {
  event.preventDefault()
  showContextMenu.value = true

  // Calculate available space
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const menuWidth = 224 // w-56 = 14rem = 224px
  const menuHeight = 200 // Approximate menu height

  // Calculate position
  let x = event.clientX
  let y = event.clientY

  // Adjust if menu would overflow right side
  if (x + menuWidth > viewportWidth) {
    x = viewportWidth - menuWidth - 8
  }

  // Adjust if menu would overflow bottom
  if (y + menuHeight > viewportHeight) {
    y = viewportHeight - menuHeight - 8
  }

  contextMenuPosition.value = { x, y }
  selectedMessage.value = message
}

// Hide context menu when clicking outside
function hideContextMenu() {
  showContextMenu.value = false
}

// Copy message text to clipboard
function copyMessageText() {
  if (selectedMessage.value?.content) {
    navigator.clipboard.writeText(selectedMessage.value.content)
      .then(() => {
        toast.success('复制成功')
      })
      .catch((err) => {
        console.error('复制失败:', err)
      })
  }
  hideContextMenu()
}

// Copy message link
async function copyMessageLink() {
  const url = await getMessageLink()
  if (url) {
    navigator.clipboard.writeText(url).then(() => {
      toast.success('复制链接成功')
    }).catch((err) => {
      console.error('复制链接失败:', err)
    })
  }
  hideContextMenu()
}

async function getMessageLink() {
  if (selectedMessage.value) {
    if (chat.value?.type === 'user') {
      const userInfo = await getUserInfo(chat.value.id.toString())
      const telegramUrl = `https://t.me/${userInfo.username}/${selectedMessage.value.id}`
      return telegramUrl
    }
    else {
      const telegramChatId = chatId.toString().replace(/^-?100/, '')
      const telegramUrl = `https://t.me/c/${telegramChatId}/${selectedMessage.value.id}`
      return telegramUrl
    }
  }
}

// Jump to Telegram app
async function jumpToTelegram() {
  const url = await getMessageLink()
  window.open(url, '_blank')
  hideContextMenu()
}

// Reply to message
function replyToMessage() {
  showReplyDialog.value = true
  hideContextMenu()
}

// Handle reply submit
async function handleReplySubmit() {
  if (replyContent.value.trim()) {
    try {
      await sendMessage(chatId, {
        message: replyContent.value,
        replyTo: selectedMessage.value?.id,
      })
      toast.success(t('pages.chat.reply_success', {
        id: selectedMessage.value?.id,
        content: replyContent.value,
      }) || `回复成功 ${selectedMessage.value?.id} ${replyContent.value}`)
    }
    catch (error) {
      console.error(error)
      toast.error(t('pages.chat.reply_failed') || '回复失败')
    }
  }
  else {
    toast.error(t('pages.chat.reply_content_empty') || '请输入回复内容')
    return
  }

  // Reset state
  showReplyDialog.value = false
  replyContent.value = ''
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

  // Add click event listener to document to close context menu
  document.addEventListener('click', hideContextMenu)
})
</script>

<template>
  <div class="h-screen flex flex-col" @click="hideContextMenu">
    <!-- Chat header -->
    <div class="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2 transition-colors duration-300 dark:border-gray-800 dark:bg-gray-900">
      <div class="flex items-center gap-2">
        <button
          class="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
          :title="t('common.back') || '返回'"
          @click="router.back()"
        >
          <div class="i-lucide-arrow-left h-5 w-5 dark:text-white" />
        </button>
        <h1 class="text-lg font-semibold dark:text-white">
          {{ chatTitle }}
          <span class="ml-2 text-xs text-gray-500 font-normal">{{ t('pages.chat.chat_id', { id: chatId }) || `ID: ${chatId}` }}</span>
        </h1>
      </div>

      <div class="flex items-center gap-2">
        <button
          class="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
          :title="t('pages.chat.search_in_chat') || '在聊天中搜索'"
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
        {{ t('pages.chat.loading_messages') || '加载消息中...' }}
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
          @jump-to-message="jumpToMessage"
          @contextmenu="(event: MouseEvent) => handleContextMenu(event, message)"
        />
      </template>
    </div>

    <!-- Context Menu -->
    <div
      v-if="showContextMenu"
      class="fixed z-50 w-56 rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-gray-800 dark:ring-gray-700"
      :style="{
        left: `${contextMenuPosition.x}px`,
        top: `${contextMenuPosition.y}px`,
      }"
      @click.stop
    >
      <div class="px-1 py-2">
        <div v-if="selectedMessage?.content" class="context-menu-item group" @click="copyMessageText">
          <div class="w-full inline-flex items-center">
            <div class="i-lucide-copy mr-3 h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
            <span class="truncate">{{ t('pages.chat.copy_message') || '复制消息' }}</span>
          </div>
        </div>

        <hr v-if="selectedMessage?.content" class="my-1 border-t border-gray-100 dark:border-gray-700">

        <div class="context-menu-item group" @click="copyMessageLink">
          <div class="w-full inline-flex items-center">
            <div class="i-lucide-link mr-3 h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
            <span class="truncate">{{ t('pages.chat.copy_link') || '复制链接' }}</span>
          </div>
        </div>

        <hr class="my-1 border-t border-gray-100 dark:border-gray-700">

        <div class="context-menu-item group" @click="jumpToTelegram">
          <div class="w-full inline-flex items-center">
            <div class="i-lucide-external-link mr-3 h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
            <span class="truncate">{{ t('pages.chat.jump_to_telegram') || '跳转到Telegram' }}</span>
          </div>
        </div>

        <hr class="my-1 border-t border-gray-100 dark:border-gray-700">

        <div class="context-menu-item group" @click="replyToMessage">
          <div class="w-full inline-flex items-center">
            <div class="i-lucide-reply mr-3 h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
            <span class="truncate">{{ t('pages.chat.reply') || '回复' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Reply Dialog -->
    <div v-if="showReplyDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" @click.self="showReplyDialog = false">
      <div class="mx-4 max-w-lg w-full rounded-lg bg-white p-6 dark:bg-gray-800">
        <h3 class="mb-4 text-lg font-semibold dark:text-white">
          {{ t('pages.chat.reply_to_message') || '回复消息' }}
        </h3>

        <!-- Original message preview -->
        <div class="mb-4 rounded-lg bg-gray-100 p-3 dark:bg-gray-700">
          <p class="line-clamp-3 text-sm text-gray-600 dark:text-gray-300">
            {{ selectedMessage?.content }}
          </p>
        </div>

        <!-- Reply input -->
        <textarea
          v-model="replyContent"
          class="mb-4 w-full border rounded-lg p-3 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          rows="3"
          :placeholder="t('pages.chat.type_your_reply') || '输入回复内容...'"
          @keydown.enter.ctrl="handleReplySubmit"
        />

        <div class="flex justify-end gap-2">
          <button
            class="rounded-lg bg-gray-200 px-4 py-2 dark:bg-gray-700 hover:bg-gray-300 dark:text-white dark:hover:bg-gray-600"
            @click="showReplyDialog = false"
          >
            {{ t('common.cancel') || '取消' }}
          </button>
          <button
            class="rounded-lg bg-blue-500 px-4 py-2 text-white dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-700"
            @click="handleReplySubmit"
          >
            {{ t('common.send') || '发送' }}
          </button>
        </div>

        <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {{ t('pages.chat.press_ctrl_enter') || '按 Ctrl + Enter 快速发送' }}
        </div>
      </div>
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

.context-menu-item {
  @apply flex items-center w-full px-8 py-4 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer;
}
</style>
