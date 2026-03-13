<script setup lang="ts">
import type { CoreRetrievalMessages, CoreRetrievalPhoto } from '@tg-search/core/types'

import type { ToolCallRecord } from '../composables/useAIChat'

import MarkdownRender from 'markstream-vue'

import { useLogger } from '@guiiai/logg'
import { useAccountStore, useAIChatStore, useChatStore } from '@tg-search/client'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import ChatSelector from '../components/ChatSelector.vue'
import PhotoSearchResults from '../components/PhotoSearchResults.vue'

import { Button } from '../components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/Dialog'
import { Textarea } from '../components/ui/Textarea'
import { useAIChatToolExecutors } from '../composables/use-ai-chat-tool-executors'
import { useAIChatLogic } from '../composables/useAIChat'

const props = withDefaults(defineProps<{
  chatIds?: number[]
}>(), {
  chatIds: () => [],
})

const { t } = useI18n()
const router = useRouter()
const route = useRoute()

const aiChatStore = useAIChatStore()
const { messages, isLoading, isSearching, searchStage, error } = storeToRefs(aiChatStore)

const { accountSettings } = storeToRefs(useAccountStore())

const messageInput = ref('')
const messagesContainer = ref<HTMLElement>()

const chatStore = useChatStore()
const { chats } = storeToRefs(chatStore)

const isScopeSelectorOpen = ref(false)
const selectedChatIds = ref<number[]>([])
const tempSelectedChatIds = ref<number[]>([])
const activeChatId = ref<number | null>(null)
const toolExecutors = useAIChatToolExecutors({ selectedChatIds })

watch(isScopeSelectorOpen, (open) => {
  if (open) {
    tempSelectedChatIds.value = [...selectedChatIds.value]
  }
})

watch(selectedChatIds, (ids) => {
  if (!isScopeSelectorOpen.value) {
    return
  }

  tempSelectedChatIds.value = [...ids]
}, { deep: true })

function confirmFilter() {
  selectedChatIds.value = [...tempSelectedChatIds.value]
  isScopeSelectorOpen.value = false
}

function cancelFilter() {
  isScopeSelectorOpen.value = false
}

function clearFilter() {
  tempSelectedChatIds.value = []
}

const filteredChatsCount = computed(() => selectedChatIds.value.length)

// Use the AI chat logic composable
const aiChatLogic = useAIChatLogic()

// Check if API is configured
const isApiConfigured = computed(() => {
  return accountSettings.value.llm.apiKey.trim().length > 0
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
  if (!messageInput.value.trim()) {
    return
  }
  const message = messageInput.value.trim()
  messageInput.value = ''
  await generateMessage(message)
}
async function generateMessage(message: string, assistantId?: string) {
  if (!isApiConfigured.value) {
    toast.error(t('aiChat.configureApi'))
    router.push('/settings')
    return
  }
  // Add user message to chat
  if (message.trim()) {
    aiChatStore.addUserMessage(message)
  }
  aiChatStore.setLoading(true)
  aiChatStore.clearError()

  try {
    const llmConfig = accountSettings.value!.llm!

    // Track all retrieved messages, photos and tool calls
    const allRetrievedMessages: CoreRetrievalMessages[] = []
    const allRetrievedPhotos: CoreRetrievalPhoto[] = []
    const toolCalls: ToolCallRecord[] = []

    const searchMessagesExecutor = async (...args: Parameters<typeof toolExecutors.searchMessages>) => {
      const results = await toolExecutors.searchMessages(...args)
      allRetrievedMessages.push(...results)
      return results
    }

    const retrieveContextExecutor = async (...args: Parameters<typeof toolExecutors.retrieveContext>) => {
      const results = await toolExecutors.retrieveContext(...args)
      allRetrievedMessages.push(...results)
      return results
    }

    const getDialogsExecutor = (...args: Parameters<typeof toolExecutors.getDialogs>) => {
      return toolExecutors.getDialogs(...args)
    }

    const searchPhotosExecutor = async (...args: Parameters<typeof toolExecutors.searchPhotos>) => {
      const results = await toolExecutors.searchPhotos(...args)
      allRetrievedPhotos.push(...results)
      return results
    }

    const chatNoteExecutor = (...args: Parameters<typeof toolExecutors.chatNote>) => {
      return toolExecutors.chatNote(...args)
    }

    // Create tools
    const searchMessagesTool = await aiChatLogic.createSearchMessagesTool(searchMessagesExecutor)
    const retrieveContextTool = await aiChatLogic.createRetrieveContextTool(retrieveContextExecutor)
    const getDialogsTool = await aiChatLogic.createGetDialogsTool(getDialogsExecutor)
    const searchPhotosTool = await aiChatLogic.createSearchPhotosTool(searchPhotosExecutor)
    const chatNoteTool = await aiChatLogic.createChatNoteTool(chatNoteExecutor)

    // Build system prompt
    const systemPrompt = aiChatLogic.buildSystemPrompt()

    // Get conversation history
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
    ]
    if (message.trim()) {
      llmMessages.push({ role: 'user' as const, content: message })
    }

    // Call LLM with tools
    const currentAssistantId = assistantId || aiChatStore.addAssistantMessage()
    let accumulatedContent = ''

    await aiChatLogic.callLLMWithTools(
      llmConfig,
      llmMessages,
      [searchMessagesTool, retrieveContextTool, getDialogsTool, searchPhotosTool, chatNoteTool],
      // onToolCall
      (toolCall) => {
        toolCalls.push(toolCall)
        // Update UI to show tool is being called
        if (toolCall.name === 'searchMessages') {
          aiChatStore.setSearching(true, `Searching messages...`)
        }
        else if (toolCall.name === 'retrieveContext') {
          aiChatStore.setSearching(true, `Retrieving context...`)
        }
        else if (toolCall.name === 'getDialogs') {
          aiChatStore.setSearching(true, `Fetching dialogs...`)
        }
        else if (toolCall.name === 'searchPhotos') {
          aiChatStore.setSearching(true, `Searching photos...`)
        }
        else if (toolCall.name === 'chatNote') {
          aiChatStore.setSearching(true, `Adding note...`)
        }
        useLogger('composables:ai-chat').withFields({ toolCall }).log('onToolCall')
      },
      // onToolResult
      (toolName, result, duration) => {
        // Find the tool call and update it with result and duration
        const toolCall = toolCalls.find(tc => tc.name === toolName && !tc.duration)
        if (toolCall) {
          toolCall.duration = duration
          toolCall.output = JSON.parse(result)
        }
      },
      // onTextDelta
      (delta) => {
        aiChatStore.setSearching(false)
        accumulatedContent += delta
        const debugInfo = {
          needsRAG: toolCalls.length > 0,
          searchQuery: '',
          toolCalls,
        }
        useLogger('composables:ai-chat').withFields({ toolCalls }).log('onTextDelta')
        aiChatStore.updateAssistantMessage(currentAssistantId, accumulatedContent, allRetrievedMessages, debugInfo, undefined, allRetrievedPhotos)
        // Auto-scroll as content updates
        nextTick().then(scrollToBottom)
      },
      // onComplete
      (totalUsage) => {
        aiChatStore.setSearching(false)
        const debugInfo = {
          needsRAG: toolCalls.length > 0,
          searchQuery: '',
          toolCalls: [
            ...toolCalls,
            {
              name: 'generateResponse',
              description: 'Generate final response',
              timestamp: Date.now(),
              usage: totalUsage,
            },
          ],
        }
        aiChatStore.updateAssistantMessage(currentAssistantId, accumulatedContent, allRetrievedMessages, debugInfo, undefined, allRetrievedPhotos)
        aiChatStore.completeAssistantMessage(currentAssistantId)
      },
    )
  }
  catch (err) {
    const errorMessage = err instanceof Error ? err.message : t('errors.unknownError')
    aiChatStore.setError(errorMessage)
    toast.error(errorMessage)
  }
  finally {
    aiChatStore.setLoading(false)
    aiChatStore.setSearching(false)
  }
}

function handleKeyPress(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault()
    sendMessage()
  }
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

function regenerateMessage(id: string) {
  aiChatStore.updateAssistantMessage(id, '', [], undefined, true, [])
  generateMessage('', id)
  toast.success(t('aiChat.regeneratedMessage'))
}

function deleteMessage(id: string) {
  aiChatStore.deleteAssistantMessage(id)
  toast.success(t('aiChat.deletedMessage'))
}

function parseChatIdsFromQuery(queryValue: string | (string | null)[] | null | undefined): number[] {
  const raw = Array.isArray(queryValue)
    ? queryValue.join(',')
    : (queryValue ?? '')

  const ids = raw
    .split(',')
    .map(item => Number.parseInt(item.trim(), 10))
    .filter(id => Number.isFinite(id) && id > 0)

  return Array.from(new Set(ids))
}

function applyRouteScope() {
  if (props.chatIds.length > 0) {
    selectedChatIds.value = Array.from(new Set(props.chatIds))
    tempSelectedChatIds.value = [...selectedChatIds.value]
    return
  }

  const ids = parseChatIdsFromQuery(route.query.chatIds)
  if (ids.length === 0) {
    return
  }

  selectedChatIds.value = ids
  tempSelectedChatIds.value = [...ids]
}

watch(() => route.query.chatIds, () => {
  if (props.chatIds.length > 0) {
    return
  }
  applyRouteScope()
})

watch(() => props.chatIds, () => {
  applyRouteScope()
}, { deep: true })

onMounted(() => {
  applyRouteScope()
  scrollToBottom()
})
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <header class="h-14 flex shrink-0 items-center justify-between border-b bg-card/50 px-4 py-0 backdrop-blur-sm md:h-16 md:px-6">
      <div class="flex items-center gap-3">
        <h1 class="text-lg font-semibold">
          {{ t('aiChat.aiChat') }}
        </h1>
      </div>

      <div class="flex items-center gap-2">
        <Button
          variant="ghost"
          class="h-9 gap-2 rounded-full px-3"
          :class="filteredChatsCount > 0 ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'text-muted-foreground hover:bg-muted'"
          @click="isScopeSelectorOpen = true"
        >
          <span class="i-lucide-filter h-4 w-4" />
          <span v-if="filteredChatsCount > 0" class="text-xs font-semibold">
            {{ t('aiChat.selectedScopeCount', { count: filteredChatsCount }) }}
          </span>
          <span v-else class="text-xs font-semibold">
            {{ t('aiChat.selectScope') }}
          </span>
        </Button>
      </div>
    </header>

    <!-- Chat Messages Area -->
    <div
      ref="messagesContainer"
      class="flex-1 overflow-y-auto scroll-smooth p-4"
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
          <div
            v-if="message.role === 'user'"
            class="wrap-break-word whitespace-pre-wrap text-sm"
          >
            {{ message.content }}
          </div>
          <div
            v-else
            class="assistant-message max-w-none overflow-x-auto text-sm"
          >
            <!-- Thinking animation -->
            <div v-if="isSearching && message.isStreaming" class="animate-pulse space-y-2">
              <div class="flex items-center gap-2 text-sm text-muted-foreground">
                <span class="i-lucide-loader-circle h-4 w-4 animate-spin" />
                <span class="font-medium">{{ searchStage || t('aiChat.searchingContext') }}</span>
              </div>
            </div>
            <div v-else-if="isLoading && message.isStreaming" class="animate-pulse space-y-2">
              <div class="flex items-center gap-2 text-sm text-muted-foreground">
                <span class="i-lucide-loader-circle h-4 w-4 animate-spin" />
                <span class="font-medium">{{ t('aiChat.aiThinking') }}</span>
              </div>
            </div>
            <MarkdownRender
              :custom-id="`ai-chat-${message.id}`"
              :content="message.content"
              :streaming="message.isStreaming"
            />
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
                  <div class="flex items-center gap-1.5">
                    <span v-if="retrieved.chatName" class="text-primary font-semibold">
                      {{ retrieved.chatName }}
                    </span>
                    <span class="font-medium opacity-60">
                      {{ new Date(retrieved.platformTimestamp * 1000).toLocaleString() }}
                    </span>
                  </div>
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

          <!-- Retrieved photos (only for assistant messages) -->
          <div
            v-if="message.role === 'assistant' && message.retrievedPhotos && message.retrievedPhotos.length > 0"
            class="mt-3 border-t border-border pt-3 space-y-2"
          >
            <div class="flex items-center gap-2 text-xs font-medium opacity-70">
              <span class="i-lucide-image h-3 w-3" />
              <span>{{ t('aiChat.retrievedPhotos') }} ({{ message.retrievedPhotos.length }})</span>
            </div>

            <PhotoSearchResults :photos="message.retrievedPhotos" />
          </div>

          <!-- Debug Info (collapsible) - only for assistant messages with debug info -->
          <div
            v-if="message.role === 'assistant' && message.debugInfo"
            class="mt-3 border-t border-border pt-3"
          >
            <details class="text-xs">
              <summary class="flex cursor-pointer items-center gap-2 font-medium opacity-60 hover:opacity-100">
                <span class="i-lucide-bug h-3 w-3" />
                <span>{{ t('aiChat.debugInfo') }}</span>
              </summary>
              <div class="mt-2 pl-5 text-[11px] opacity-70 space-y-1.5">
                <div class="flex gap-2">
                  <span class="font-medium">{{ t('aiChat.searchQuery') }}:</span>
                  <span class="font-mono">{{ message.debugInfo.searchQuery || 'N/A' }}</span>
                </div>
                <div v-if="message.debugInfo.fromUserId" class="flex gap-2">
                  <span class="font-medium">{{ t('aiChat.userFilter') }}:</span>
                  <span class="font-mono">{{ message.debugInfo.fromUserId }}</span>
                </div>
                <div v-if="message.debugInfo.timeRange" class="flex gap-2">
                  <span class="font-medium">{{ t('aiChat.timeFilter') }}:</span>
                  <span class="font-mono">
                    {{ message.debugInfo.timeRange.start ? new Date(message.debugInfo.timeRange.start * 1000).toLocaleDateString() : '?' }}
                    -
                    {{ message.debugInfo.timeRange.end ? new Date(message.debugInfo.timeRange.end * 1000).toLocaleDateString() : '?' }}
                  </span>
                </div>
                <div v-if="message.debugInfo.deepSearch" class="mt-1.5 border-t border-border/50 pt-1.5">
                  <div class="mb-1 font-medium">
                    {{ t('aiChat.deepSearch') }}:
                  </div>
                  <div class="pl-2 space-y-0.5">
                    <div>{{ t('aiChat.initialResults') }}: {{ message.debugInfo.deepSearch.initialResults }}</div>
                    <div>{{ t('aiChat.contextRetrievals') }}: {{ message.debugInfo.deepSearch.contextRetrievals }}</div>
                    <div>{{ t('aiChat.totalMessages') }}: {{ message.debugInfo.deepSearch.totalMessages }}</div>
                  </div>
                </div>
                <div v-if="message.debugInfo.toolCalls && message.debugInfo.toolCalls.length > 0" class="mt-1.5 border-t border-border/50 pt-1.5">
                  <div class="mb-1 flex items-center justify-between">
                    <span class="font-medium">{{ t('aiChat.toolCalls') }}:</span>
                    <div class="flex items-center gap-2 text-[9px] opacity-60">
                      <span>{{ t('aiChat.total') }}: {{ message.debugInfo.toolCalls.reduce((sum, t) => sum + (t.duration || 0), 0) }}ms</span>
                      <span v-if="message.debugInfo.toolCalls.some(t => t.usage)">
                        | {{ message.debugInfo.toolCalls.reduce((sum, t) => sum + (t.usage?.totalTokens || 0), 0) }} {{ t('aiChat.tokens') }}
                      </span>
                    </div>
                  </div>
                  <div class="space-y-2">
                    <details
                      v-for="(tool, idx) in message.debugInfo.toolCalls"
                      :key="`tool-${idx}`"
                      class="border border-border/30 rounded bg-muted/20 p-1.5"
                    >
                      <summary class="flex cursor-pointer items-center justify-between gap-2 text-[10px] font-medium opacity-80 hover:opacity-100">
                        <div class="flex items-center gap-1.5">
                          <span class="i-lucide-zap h-2.5 w-2.5" />
                          <span class="font-mono">{{ tool.name }}</span>
                          <span v-if="tool.duration" class="rounded bg-accent/30 px-1 py-0.5 text-[9px] opacity-70">
                            {{ tool.duration }}ms
                          </span>
                        </div>
                        <div class="flex items-center gap-1.5">
                          <span v-if="tool.usage?.totalTokens" class="rounded bg-primary/20 px-1 py-0.5 text-[9px] opacity-70">
                            {{ tool.usage.totalTokens }} tokens
                          </span>
                          <span class="opacity-60">{{ new Date(tool.timestamp).toLocaleTimeString() }}</span>
                        </div>
                      </summary>
                      <div class="mt-1.5 pl-4 text-[10px] space-y-1">
                        <div class="opacity-60">
                          {{ tool.description }}
                        </div>
                        <div v-if="tool.usage" class="flex items-center gap-2 rounded bg-primary/10 p-1 text-[9px]">
                          <span class="font-medium opacity-70">{{ t('aiChat.tokenUsage') }}:</span>
                          <span class="opacity-60">{{ t('aiChat.prompt') }}: {{ tool.usage.promptTokens || 0 }}</span>
                          <span class="opacity-60">{{ t('aiChat.completion') }}: {{ tool.usage.completionTokens || 0 }}</span>
                          <span class="font-medium opacity-70">{{ t('aiChat.total') }}: {{ tool.usage.totalTokens || 0 }}</span>
                        </div>
                        <div v-if="tool.input" class="rounded bg-muted/50 p-1">
                          <div class="mb-0.5 font-medium opacity-70">
                            {{ t('aiChat.input') }}:
                          </div>
                          <pre class="whitespace-pre-wrap break-all font-mono opacity-60">{{ JSON.stringify(tool.input, null, 2) }}</pre>
                        </div>
                        <div v-if="tool.output" class="rounded bg-muted/50 p-1">
                          <div class="mb-0.5 font-medium opacity-70">
                            {{ t('aiChat.output') }}:
                          </div>
                          <pre class="whitespace-pre-wrap break-all font-mono opacity-60">{{ JSON.stringify(tool.output, null, 2) }}</pre>
                        </div>
                      </div>
                    </details>
                  </div>
                </div>
              </div>
            </details>
          </div>

          <!-- Tool bar -->
          <div v-if="message.role === 'assistant' && message.content.length !== 0" class="flex justify-end gap-2">
            <Button
              icon="i-lucide-copy"
              class="h-4 w-4 shrink-0 px-0 opacity-50 transition-opacity hover:opacity-100"
              @click="copyMessage(message.content)"
            >
              <!-- {{ t('aiChat.copy') }} -->
            </Button>
            <Button
              icon="i-lucide-rotate-ccw"
              class="h-4 w-4 shrink-0 px-0 opacity-50 transition-opacity hover:opacity-100"
              @click="regenerateMessage(message.id)"
            >
              <!-- {{ t('aiChat.copy') }} -->
            </Button>
            <Button
              icon="i-lucide-trash-2"
              class="h-4 w-4 shrink-0 px-0 opacity-50 transition-opacity hover:text-red hover:opacity-100"
              @click="deleteMessage(message.id)"
            >
              <!-- {{ t('aiChat.copy') }} -->
            </Button>
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
          <Textarea
            v-model="messageInput"
            :placeholder="t('aiChat.typeYourMessage')"
            class="max-h-32 min-h-12 flex-1 resize-none border-input rounded-xl bg-background px-4 py-3 text-sm shadow-sm transition-all focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
            rows="1"
            @keydown="handleKeyPress"
          />
          <Button
            :disabled="!messageInput.trim() || isLoading"
            class="h-12 w-12 flex shrink-0 items-center justify-center rounded-xl p-0 shadow-sm transition-all active:scale-95 hover:scale-105"
            @click="sendMessage"
          >
            <span class="i-lucide-send h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  </div>

  <!-- Chat Scope Selector Dialog -->
  <Dialog v-model:open="isScopeSelectorOpen">
    <DialogContent class="h-[80vh] max-w-[calc(100%-2rem)] flex flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-4xl" :show-close-button="false">
      <DialogHeader class="shrink-0 border-b px-6 py-4">
        <DialogTitle>{{ t('aiChat.selectScope') }}</DialogTitle>
        <DialogDescription>
          {{ t('aiChat.selectScopeDescription') }}
        </DialogDescription>
      </DialogHeader>

      <div class="min-h-0 flex-1 p-4">
        <ChatSelector
          v-model:selected-chats="tempSelectedChatIds"
          v-model:active-chat-id="activeChatId"
          :chats="chats"
          class="h-full"
        >
          <template #actions>
            <Button
              v-if="tempSelectedChatIds.length > 0"
              variant="ghost"
              size="sm"
              class="h-10 px-2 text-xs text-destructive hover:text-destructive"
              @click="clearFilter"
            >
              <span class="i-lucide-trash-2 mr-1 h-4 w-4" />
              {{ t('common.clear') }}
            </Button>
          </template>
        </ChatSelector>
      </div>

      <DialogFooter class="shrink-0 border-t bg-muted/10 px-6 py-4">
        <Button
          variant="ghost"
          @click="cancelFilter"
        >
          {{ t('common.cancel') }}
        </Button>
        <Button
          @click="confirmFilter"
        >
          {{ t('common.confirm') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
