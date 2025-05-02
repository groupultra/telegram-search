<script setup lang="ts">
import { useScroll } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'

import { useMessageStore } from '../../store/useMessage'
import { useSessionStore } from '../../store/useSession'

const route = useRoute('/chat/:id')
const id = route.params.id

const messageStore = useMessageStore()
const { messagesByChat } = storeToRefs(messageStore)
const chatMessages = computed(() =>
  Array.from(messagesByChat.value.get(id.toString()) ?? [])
    .sort((a, b) =>
      a.createdAt <= b.createdAt ? -1 : 1,
    ),
)
const messageLimit = ref(50)
const messageOffset = ref(0)

const sessionStore = useSessionStore()
const { getWsContext } = sessionStore

const messageInput = ref('')
const messagesContainer = ref<HTMLElement | null>(null)
const { y } = useScroll(messagesContainer)

const lastMessagePosition = ref(0)

watch(chatMessages, () => {
  lastMessagePosition.value = messagesContainer.value?.scrollHeight ?? 0

  nextTick(() => {
    y.value = lastMessagePosition.value
  })
})

watch(y, () => {
  if (y.value === 0) {
    messageStore.fetchMessagesWithDatabase(id.toString(), { offset: messageOffset.value, limit: messageLimit.value })
    messageOffset.value += messageLimit.value
  }
}, { immediate: true })

function sendMessage() {
  if (!messageInput.value.trim())
    return

  getWsContext()?.sendEvent('message:send', {
    chatId: id.toString(),
    content: messageInput.value,
  })
  messageInput.value = ''

  toast.success('Message sent')
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Chat Header -->
    <div class="p-4 border-b dark:border-gray-700">
      <h2 class="text-xl font-semibold dark:text-gray-100">
        Chat #{{ id }}
      </h2>
    </div>

    <!-- Messages Area -->
    <div
      ref="messagesContainer"
      class="flex-1 overflow-y-auto p-4 space-y-4"
    >
      <div v-for="message in chatMessages" :key="message.uuid">
        <MessageBubble :message="message" />
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
  </div>
</template>
