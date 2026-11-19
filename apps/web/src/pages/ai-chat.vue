<script setup lang="ts">
import type { CoreRetrievalMessages, CoreRetrievalPhoto } from '@tg-search/core/types'

import type { ToolCallRecord } from '../composables/useAIChat'

import MarkdownRender from 'markstream-vue'

import { useLogger } from '@guiiai/logg'
import { useAccountStore, useAIChatStore, useChatStore } from '@tg-search/client'
import { useDark } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import ChatSelector from '../components/ChatSelector.vue'
import PageHeader from '../components/layout/PageHeader.vue'
import MessageComposer from '../components/MessageComposer.vue'
import PhotoSearchResults from '../components/PhotoSearchResults.vue'

import { ActionIcon } from '../components/ui/ActionIcon'
import { Button } from '../components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/Dialog'
import { Empty } from '../components/ui/Empty'
import { Spinner } from '../components/ui/Spinner'
import { Tag } from '../components/ui/Tag'
import { useAIChatToolExecutors } from '../composables/use-ai-chat-tool-executors'
import { useAIChatLogic } from '../composables/useAIChat'

const props = withDefaults(defineProps<{
  chatIds?: number[]
}>(), {
  chatIds: () => [],
})

const { t } = useI18n()
const isDark = useDark()
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
  <div class="h-full flex flex-col bg-container">
    <!-- Header -->
    <PageHeader :title="t('aiChat.aiChat')">
      <Button icon="i-lucide-list-filter" @click="isScopeSelectorOpen = true">
        {{ filteredChatsCount > 0 ? t('aiChat.selectedScopeCount', { count: filteredChatsCount }) : t('aiChat.selectScope') }}
      </Button>
    </PageHeader>

    <!-- Chat Messages Area -->
    <div
      ref="messagesContainer"
      class="flex-1 overflow-y-auto scroll-smooth"
    >
      <div class="mx-auto max-w-3xl min-h-full flex flex-col gap-6 px-4 py-6 md:px-6">
        <!-- Empty state -->
        <Empty v-if="messages.length === 0" icon="i-lucide-sparkles" :title="t('aiChat.typeYourMessage')" class="flex-1" />

        <!-- Messages -->
        <div
          v-for="message in messages"
          :key="message.id"
          class="flex"
          :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
        >
          <div
            class="min-w-0 space-y-2"
            :class="message.role === 'user'
              ? 'max-w-[85%] rounded-lg bg-fill-2 px-3 py-2 text-fg'
              : 'w-full'
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
              <div v-if="isSearching && message.isStreaming" class="flex items-center gap-2 text-sm text-fg-3">
                <Spinner />
                <span>{{ searchStage || t('aiChat.searchingContext') }}</span>
              </div>
              <div v-else-if="isLoading && message.isStreaming" class="flex items-center gap-2 text-sm text-fg-3">
                <Spinner />
                <span>{{ t('aiChat.aiThinking') }}</span>
              </div>
              <MarkdownRender
                :custom-id="`ai-chat-${message.id}`"
                :content="message.content"
                :final="!message.isStreaming"
                :is-dark="isDark"
                :smooth-streaming="true"
              />
            </div>

            <!-- Retrieved messages (only for assistant messages) -->
            <div
              v-if="message.role === 'assistant' && message.retrievedMessages && message.retrievedMessages.length > 0"
              class="mt-3 space-y-2"
            >
              <div class="flex items-center gap-2 eyebrow">
                <span class="i-lucide-quote h-3 w-3" />
                <span>{{ t('aiChat.retrievedInfo') }} ({{ message.retrievedMessages.length }})</span>
              </div>

              <div class="space-y-2">
                <div
                  v-for="(retrieved, idx) in message.retrievedMessages"
                  :key="`${message.id}-retrieved-${idx}`"
                  class="cursor-pointer rounded-md bg-fill-3 px-3 py-2 text-xs transition-colors hover:bg-fill-2"
                  @click="viewMessageInChat(retrieved.chatId, retrieved.platformMessageId)"
                >
                  <div class="mb-1 flex items-center justify-between">
                    <div class="flex items-center gap-1.5">
                      <span v-if="retrieved.chatName" class="text-fg font-medium">
                        {{ retrieved.chatName }}
                      </span>
                      <span class="text-fg-3">
                        {{ new Date(retrieved.platformTimestamp * 1000).toLocaleString() }}
                      </span>
                    </div>
                    <Tag v-if="retrieved.similarity" size="sm">
                      {{ (retrieved.similarity * 100).toFixed(0) }}%
                    </Tag>
                  </div>
                  <div class="line-clamp-2 text-fg-2">
                    {{ retrieved.content || '[Media]' }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Retrieved photos (only for assistant messages) -->
            <div
              v-if="message.role === 'assistant' && message.retrievedPhotos && message.retrievedPhotos.length > 0"
              class="mt-3 space-y-2"
            >
              <div class="flex items-center gap-2 eyebrow">
                <span class="i-lucide-image h-3 w-3" />
                <span>{{ t('aiChat.retrievedPhotos') }} ({{ message.retrievedPhotos.length }})</span>
              </div>

              <PhotoSearchResults :photos="message.retrievedPhotos" />
            </div>

            <!-- Debug Info (collapsible) - only for assistant messages with debug info -->
            <div
              v-if="message.role === 'assistant' && message.debugInfo"
              class="mt-3"
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
                  <div v-if="message.debugInfo.deepSearch" class="mt-1.5 border-t border-line-2 pt-1.5">
                    <div class="mb-1 font-medium">
                      {{ t('aiChat.deepSearch') }}:
                    </div>
                    <div class="pl-2 space-y-0.5">
                      <div>{{ t('aiChat.initialResults') }}: {{ message.debugInfo.deepSearch.initialResults }}</div>
                      <div>{{ t('aiChat.contextRetrievals') }}: {{ message.debugInfo.deepSearch.contextRetrievals }}</div>
                      <div>{{ t('aiChat.totalMessages') }}: {{ message.debugInfo.deepSearch.totalMessages }}</div>
                    </div>
                  </div>
                  <div v-if="message.debugInfo.toolCalls && message.debugInfo.toolCalls.length > 0" class="mt-1.5 border-t border-line-2 pt-1.5">
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
                        class="border border-line-2 rounded bg-fill-3 p-1.5"
                      >
                        <summary class="flex cursor-pointer items-center justify-between gap-2 text-[10px] font-medium opacity-80 hover:opacity-100">
                          <div class="flex items-center gap-1.5">
                            <span class="i-lucide-zap h-2.5 w-2.5" />
                            <span class="font-mono">{{ tool.name }}</span>
                            <span v-if="tool.duration" class="rounded bg-fill-2 px-1 py-0.5 text-[9px] opacity-70">
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
                          <div v-if="tool.input" class="rounded bg-fill-3 p-1">
                            <div class="mb-0.5 font-medium opacity-70">
                              {{ t('aiChat.input') }}:
                            </div>
                            <pre class="whitespace-pre-wrap break-all font-mono opacity-60">{{ JSON.stringify(tool.input, null, 2) }}</pre>
                          </div>
                          <div v-if="tool.output" class="rounded bg-fill-3 p-1">
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
            <div v-if="message.role === 'assistant' && message.content.length !== 0" class="flex gap-1 -ml-1.5">
              <ActionIcon icon="i-lucide-copy" size="sm" @click="copyMessage(message.content)" />
              <ActionIcon icon="i-lucide-rotate-ccw" size="sm" @click="regenerateMessage(message.id)" />
              <ActionIcon icon="i-lucide-trash-2" size="sm" danger @click="deleteMessage(message.id)" />
            </div>
          </div>
        </div>

        <!-- Error message -->
        <div
          v-if="error"
          class="flex items-center gap-2 rounded-md bg-destructive/12 px-3 py-2 text-sm text-destructive"
        >
          <span class="i-lucide-alert-circle h-4 w-4 shrink-0" />
          <span>{{ error }}</span>
        </div>
      </div>
    </div>

    <!-- Input Area -->
    <div class="shrink-0 px-3 pb-4 pt-1 md:px-4">
      <MessageComposer
        v-model="messageInput"
        multiline
        :placeholder="t('aiChat.typeYourMessage')"
        :send-disabled="isLoading"
        @keydown="handleKeyPress"
        @send="sendMessage"
      />
    </div>
  </div>

  <!-- Chat Scope Selector Dialog -->
  <Dialog v-model:open="isScopeSelectorOpen">
    <DialogContent class="h-[80vh] max-w-[calc(100%-2rem)] flex flex-col gap-0 overflow-hidden rounded-lg p-0 sm:max-w-4xl" :show-close-button="false">
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
              variant="text"
              class="text-destructive hover:text-destructive"
              @click="clearFilter"
            >
              <span class="i-lucide-trash-2 h-4 w-4" />
              {{ t('common.clear') }}
            </Button>
          </template>
        </ChatSelector>
      </div>

      <DialogFooter class="shrink-0 border-t px-6 py-3">
        <Button
          variant="text"
          @click="cancelFilter"
        >
          {{ t('common.cancel') }}
        </Button>
        <Button
          variant="primary"
          @click="confirmFilter"
        >
          {{ t('common.confirm') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
