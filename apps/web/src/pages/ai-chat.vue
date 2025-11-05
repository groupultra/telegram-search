<script setup lang="ts">
import { useAIChatStore, useBridgeStore, useSettingsStore } from '@tg-search/client'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import { Button } from '../components/ui/Button'

const { t } = useI18n()
const router = useRouter()

const aiChatStore = useAIChatStore()
const { messages, isLoading, error } = storeToRefs(aiChatStore)

const bridgeStore = useBridgeStore()
const settingsStore = useSettingsStore()
const { config } = storeToRefs(settingsStore)

const messageInput = ref('')
const messagesContainer = ref<HTMLElement>()

// Check if API is configured
const isApiConfigured = computed(() => {
  return config.value?.api?.llm?.apiKey && config.value.api.llm.apiKey.trim().length > 0
})

// Scroll to bottom when new messages arrive
watch(() => messages.value.length, async () => {
  await nextTick()
  scrollToBottom()
})

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

async function sendMessage() {
  if (!messageInput.value.trim())
    return

  if (!isApiConfigured.value) {
    toast.error(t('aiChat.configureApi'))
    router.push('/settings')
    return
  }

  const message = messageInput.value.trim()
  messageInput.value = ''

  // Add user message to chat
  aiChatStore.addUserMessage(message)
  aiChatStore.setLoading(true)

  // Build conversation history
  const conversationHistory = messages.value.map(msg => ({
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp,
  }))

  // Send to backend
  bridgeStore.sendEvent('ai-chat:send', {
    message,
    conversationHistory,
  })
}

function handleKeyPress(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendMessage()
  }
}

function clearChat() {
  aiChatStore.clearChat()
  toast.success(t('aiChat.clearChat'))
}

function viewMessageInChat(chatId: string, messageId: number) {
  router.push(`/chat/${chatId}?messageId=${messageId}`)
}

function copyMessage(content: string) {
  navigator.clipboard.writeText(content)
  toast.success(t('aiChat.copiedToClipboard'))
}

onMounted(() => {
  scrollToBottom()
})
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <header class="flex items-center justify-between border-b bg-card/50 px-6 py-4 backdrop-blur-sm">
      <div class="flex items-center gap-3">
        <span class="i-lucide-message-square-text h-5 w-5 text-primary" />
        <h1 class="text-lg font-semibold">
          {{ t('aiChat.aiChat') }}
        </h1>
      </div>
      <div class="flex items-center gap-2">
        <Button
          v-if="messages.length > 0"
          icon="i-lucide-trash-2"
          variant="ghost"
          size="sm"
          @click="clearChat"
        >
          {{ t('aiChat.clearChat') }}
        </Button>
      </div>
    </header>

    <!-- Messages Area -->
    <div
      ref="messagesContainer"
      class="flex-1 overflow-y-auto p-6 space-y-4"
    >
      <!-- Empty state -->
      <div
        v-if="messages.length === 0"
        class="h-full flex flex-col items-center justify-center text-muted-foreground"
      >
        <span class="i-lucide-message-square-text mb-4 text-6xl opacity-20" />
        <p class="text-center text-sm">
          {{ t('aiChat.typeYourMessage') }}
        </p>
      </div>

      <!-- Messages -->
      <div
        v-for="message in messages"
        :key="message.id"
        class="flex"
        :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
      >
        <div
          class="max-w-[80%] rounded-lg px-4 py-3 space-y-2"
          :class="message.role === 'user'
            ? 'bg-primary text-primary-foreground'
            : 'border bg-card'
          "
        >
          <!-- Message content -->
          <div class="whitespace-pre-wrap break-words text-sm">
            {{ message.content }}
          </div>

          <!-- Retrieved messages (only for assistant messages) -->
          <div
            v-if="message.role === 'assistant' && message.retrievedMessages && message.retrievedMessages.length > 0"
            class="mt-3 border-t border-border pt-3 space-y-2"
          >
            <div class="flex items-center gap-2 text-xs font-medium opacity-70">
              <span class="i-lucide-info h-3 w-3" />
              <span>{{ t('aiChat.retrievedInfo') }} ({{ message.retrievedMessages.length }})</span>
            </div>

            <div class="space-y-2">
              <div
                v-for="(retrieved, idx) in message.retrievedMessages"
                :key="`${message.id}-retrieved-${idx}`"
                class="cursor-pointer border rounded bg-muted/50 p-2 text-xs transition-colors hover:bg-accent/50"
                @click="viewMessageInChat(retrieved.chatId, Number(retrieved.platformMessageId))"
              >
                <div class="mb-1 flex items-center justify-between">
                  <span class="font-medium opacity-80">
                    {{ new Date(retrieved.platformTimestamp).toLocaleString() }}
                  </span>
                  <span
                    v-if="retrieved.similarity"
                    class="rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium"
                  >
                    {{ (retrieved.similarity * 100).toFixed(0) }}%
                  </span>
                </div>
                <div class="line-clamp-2 opacity-70">
                  {{ retrieved.content || '[Media]' }}
                </div>
              </div>
            </div>
          </div>

          <!-- Copy button -->
          <div class="flex justify-end">
            <button
              class="opacity-50 transition-opacity hover:opacity-100"
              @click="copyMessage(message.content)"
            >
              <span class="i-lucide-copy h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      <!-- Loading indicator -->
      <div
        v-if="isLoading"
        class="flex justify-start"
      >
        <div class="max-w-[80%] border rounded-lg bg-card px-4 py-3 space-y-2">
          <div class="flex items-center gap-2 text-sm text-muted-foreground">
            <span class="i-lucide-loader-circle animate-spin" />
            <span>{{ t('aiChat.aiThinking') }}</span>
          </div>
        </div>
      </div>

      <!-- Error message -->
      <div
        v-if="error"
        class="flex justify-center"
      >
        <div class="max-w-[80%] border border-destructive rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <div class="flex items-center gap-2">
            <span class="i-lucide-alert-circle h-4 w-4" />
            <span>{{ error }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Input Area -->
    <div class="border-t bg-card/50 p-4 backdrop-blur-sm">
      <div class="mx-auto max-w-4xl">
        <div class="flex items-end gap-2">
          <textarea
            v-model="messageInput"
            :placeholder="t('aiChat.typeYourMessage')"
            class="max-h-32 min-h-12 flex-1 resize-none border rounded-lg bg-background px-4 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            rows="1"
            @keydown="handleKeyPress"
          />
          <Button
            icon="i-lucide-send"
            :disabled="!messageInput.trim() || isLoading"
            @click="sendMessage"
          >
            {{ t('aiChat.send') }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
