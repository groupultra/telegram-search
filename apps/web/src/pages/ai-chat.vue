<script setup lang="ts">
import type { CoreRetrievalMessages } from '@tg-search/core/types'

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
const { messages, isLoading, isSearching, error } = storeToRefs(aiChatStore)

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
  aiChatStore.clearError()

  try {
    const llmConfig = config.value!.api!.llm!

    // Step 1: Use a small/fast model to determine if RAG is needed and what to search
    aiChatStore.setSearching(true)
    const ragDecision = await determineRAGNeeds(message, llmConfig)

    let retrievedMessages: CoreRetrievalMessages[] = []

    // Step 2: If RAG is needed, perform search with animation showing
    if (ragDecision.needsRAG && ragDecision.searchQuery) {
      retrievedMessages = await new Promise((resolve) => {
        bridgeStore.waitForEvent('storage:search:messages:data').then(({ messages }) => {
          resolve(messages)
        })

        bridgeStore.sendEvent('storage:search:messages', {
          content: ragDecision.searchQuery,
          useVector: true,
          pagination: {
            limit: 5,
            offset: 0,
          },
        })
      })
    }

    aiChatStore.setSearching(false)

    // Step 3: Build context from retrieved messages
    const contextMessages = retrievedMessages.map((msg) => {
      const date = new Date(msg.platformTimestamp).toLocaleString()
      // eslint-disable-next-line no-control-regex
      const sanitizedContent = (msg.content || '[Media]').replace(/[\x00-\x1F\x7F]/g, '')
      return `[${date}] ${sanitizedContent}`
    }).join('\n\n')

    // Step 4: Build the prompt with conversation history
    const systemPrompt = contextMessages
      ? `You are a helpful AI assistant that helps users understand their Telegram message history. 

Below is relevant context retrieved from the user's messages:

${contextMessages}

Use this context to provide helpful, accurate responses.`
      : 'You are a helpful AI assistant. Answer the user\'s question directly and concisely.'

    const conversationHistory = messages.value
      .filter(msg => msg.role !== 'user' || msg.content !== message)
      .slice(-10) // Keep last 10 messages for context
      .map(msg => ({
        role: msg.role,
        content: msg.content,
      }))

    const llmMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...conversationHistory,
      { role: 'user' as const, content: message },
    ]

    // Step 5: Call LLM API with streaming from frontend
    const assistantId = aiChatStore.addAssistantMessage()
    await callLLMAPIStreaming(llmConfig, llmMessages, assistantId, retrievedMessages)
  }
  catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
    aiChatStore.setError(errorMessage)
    toast.error(errorMessage)
  }
  finally {
    aiChatStore.setLoading(false)
    aiChatStore.setSearching(false)
  }
}

// Use a small model to determine if RAG is needed
async function determineRAGNeeds(message: string, llmConfig: any): Promise<{ needsRAG: boolean, searchQuery: string }> {
  const apiUrl = `${llmConfig.apiBase}/chat/completions`

  const systemPrompt = `You are a query analyzer. Determine if the user's question needs context from their Telegram message history to answer.
If it needs context, extract the key search terms/query.
Respond in JSON format: {"needsRAG": boolean, "searchQuery": "extracted query or empty string"}

Examples:
- "What did John say about the meeting?" -> {"needsRAG": true, "searchQuery": "John meeting"}
- "What's the capital of France?" -> {"needsRAG": false, "searchQuery": ""}
- "Summarize our discussion about the project" -> {"needsRAG": true, "searchQuery": "discussion project"}
- "Tell me a joke" -> {"needsRAG": false, "searchQuery": ""}`

  const requestBody = {
    model: llmConfig.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ],
    temperature: 0.1,
    max_tokens: 100,
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llmConfig.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      // If the decision API fails, default to always using RAG
      return { needsRAG: true, searchQuery: message }
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || '{}'

    // Try to parse JSON response
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0])
        return {
          needsRAG: result.needsRAG || false,
          searchQuery: result.searchQuery || '',
        }
      }
    }
    catch {
      // If parsing fails, default to using RAG
      return { needsRAG: true, searchQuery: message }
    }

    return { needsRAG: true, searchQuery: message }
  }
  catch {
    // On error, default to using RAG
    return { needsRAG: true, searchQuery: message }
  }
}

// Call LLM API with streaming support
async function callLLMAPIStreaming(
  llmConfig: any,
  llmMessages: any[],
  assistantId: string,
  retrievedMessages: CoreRetrievalMessages[],
): Promise<void> {
  const apiUrl = `${llmConfig.apiBase}/chat/completions`

  const requestBody = {
    model: llmConfig.model,
    messages: llmMessages,
    temperature: llmConfig.temperature ?? 0.7,
    max_tokens: llmConfig.maxTokens ?? 2000,
    stream: true, // Enable streaming
  }

  const abortController = new AbortController()
  const timeoutId = setTimeout(() => abortController.abort(), 60000) // 60s for streaming

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${llmConfig.apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: abortController.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`LLM API request failed: ${response.status} ${errorText}`)
    }

    if (!response.body) {
      throw new Error('Response body is null')
    }

    // Process the streaming response
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let accumulatedContent = ''

    while (true) {
      const { done, value } = await reader.read()

      if (done)
        break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)

          if (data === '[DONE]')
            continue

          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta?.content

            if (delta) {
              accumulatedContent += delta
              aiChatStore.updateAssistantMessage(assistantId, accumulatedContent, retrievedMessages)
              // Auto-scroll as content updates
              await nextTick()
              scrollToBottom()
            }
          }
          catch {
            // Ignore parsing errors for partial chunks
          }
        }
      }
    }

    // Mark streaming as complete
    aiChatStore.completeAssistantMessage(assistantId)
  }
  catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('LLM API request timed out')
    }
    throw error
  }
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

function viewMessageInChat(chatId: string, platformMessageId: string) {
  // Convert platformMessageId string to number for the route parameter
  const messageId = Number.parseInt(platformMessageId, 10)
  if (Number.isNaN(messageId)) {
    toast.error('Invalid message ID')
    return
  }
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
            <span v-if="message.isStreaming" class="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current" />
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
                @click="viewMessageInChat(retrieved.chatId, retrieved.platformMessageId)"
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

      <!-- Loading/Searching indicator -->
      <div
        v-if="isSearching || isLoading"
        class="flex justify-start"
      >
        <div class="max-w-[80%] border rounded-lg bg-card px-4 py-3 space-y-2">
          <!-- Search animation -->
          <div v-if="isSearching" class="flex items-center gap-2 text-sm text-muted-foreground">
            <span class="i-lucide-search h-4 w-4 animate-pulse" />
            <span>{{ t('aiChat.searchingContext') }}</span>
          </div>
          <!-- Thinking animation -->
          <div v-else-if="isLoading" class="flex items-center gap-2 text-sm text-muted-foreground">
            <span class="i-lucide-loader-circle h-4 w-4 animate-spin" />
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
