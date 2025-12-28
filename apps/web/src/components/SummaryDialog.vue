<script setup lang="ts">
import type { CoreMessage } from '@tg-search/core'

import type { LLMMessage } from '../composables/useAIChat'

import MarkdownRender from 'markstream-vue'

import { useAccountStore, useBridge } from '@tg-search/client'
import { useDateFormat } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import Dialog from './ui/Dialog.vue'

import { useAIChatLogic } from '../composables/useAIChat'
import { useSummarizeStore } from '../stores/summarize'
import { Button } from './ui/Button'

type SummaryMode = 'unread' | 'today' | 'last24h'

const props = defineProps<{
  chatId: string
}>()

const { t } = useI18n()
const router = useRouter()

const isOpen = ref(false)
const bridge = useBridge()
const account = useAccountStore()
const aiChatLogic = useAIChatLogic()
const summarizeStore = useSummarizeStore()
const activeMode = ref<SummaryMode>('unread')

const session = computed(() => summarizeStore.getSession(props.chatId))

async function open() {
  isOpen.value = true

  // If we already have a summary, don't auto-fetch unless empty
  if (session.value.content || session.value.sourceMessages.length > 0)
    return

  await triggerGenerate('unread', true)
}

async function triggerGenerate(mode: SummaryMode, autoFallbackWhenNoUnread = false) {
  activeMode.value = mode
  await fetchSummaryAndGenerate(mode, autoFallbackWhenNoUnread)
}

async function fetchSummaryAndGenerate(mode: SummaryMode, autoFallbackWhenNoUnread = false) {
  summarizeStore.setLoading(props.chatId, true)
  summarizeStore.setSummary(props.chatId, '', [], { mode: 'none' })
  summarizeStore.setSourceMessages(props.chatId, [], { mode: 'none' })

  bridge.sendEvent('message:fetch:summary', {
    chatId: props.chatId,
    mode,
    limit: 1000,
  })

  try {
    const data = await bridge.waitForEvent('message:summary-data')
    summarizeStore.setSourceMessages(props.chatId, data.messages, { mode: data.mode })

    if (data.messages.length === 0) {
      if (autoFallbackWhenNoUnread && mode === 'unread') {
        toast.info(t('summaryDialog.autoFallbackToLast24h'))
        await triggerGenerate('last24h', false)
        return
      }

      toast.info(t('summaryDialog.noMessagesToSummarize'))
      summarizeStore.setLoading(props.chatId, false)
      summarizeStore.setSummary(props.chatId, t('summaryDialog.noMessagesToSummarizeDescription'), [], { mode: 'none' })
      return
    }

    await generateSummary(data.messages, { mode: data.mode })
  }
  catch (e) {
    toast.error(t('summaryDialog.fetchFailed'))
    summarizeStore.setLoading(props.chatId, false)
    console.error(e)
  }
}

async function generateSummary(
  messages: CoreMessage[],
  meta?: { mode?: SummaryMode },
) {
  // Check for API Key
  const settings = account.accountSettings?.llm
  const apiKey = settings?.apiKey

  if (!apiKey) {
    toast.error(t('summaryDialog.noApiKey'))
    summarizeStore.setSummary(props.chatId, t('summaryDialog.configureApiKey'), messages, meta)
    summarizeStore.setLoading(props.chatId, false)
    return
  }

  const baseURL = settings?.apiBase || 'https://api.openai.com/v1'
  const model = settings?.model || 'gpt-4o-mini'

  const content = messages.map((m) => {
    const name = m.fromName || (m.fromId ? `User ${m.fromId}` : 'Unknown')
    return `${name}: ${m.content}`
  }).join('\n')

  const llmConfig = {
    apiKey,
    apiBase: baseURL,
    model,
    temperature: settings?.temperature,
    maxTokens: settings?.maxTokens,
  }

  const llmMessages: LLMMessage[] = [
    {
      role: 'system',
      content: 'You are a helpful assistant. Summarize the following telegram messages concisely with Chinese.',
    },
    {
      role: 'user',
      content,
    },
  ]

  try {
    // Clear content before streaming and keep skeleton until first token arrives.
    summarizeStore.setSummary(props.chatId, '', messages, meta)
    summarizeStore.setLoading(props.chatId, true)

    let receivedFirstDelta = false
    await aiChatLogic.streamSimpleText(llmConfig, llmMessages, (delta) => {
      if (!receivedFirstDelta) {
        receivedFirstDelta = true
        summarizeStore.setLoading(props.chatId, false)
      }
      summarizeStore.appendSummary(props.chatId, delta)
    })
    summarizeStore.setLoading(props.chatId, false)
  }
  catch (e) {
    console.error(e)
    toast.error(t('summaryDialog.summaryFailed'))
    summarizeStore.appendSummary(props.chatId, `\n${t('summaryDialog.summaryFailedNote')}`)
    summarizeStore.setLoading(props.chatId, false)
  }
}

async function markRead() {
  bridge.sendEvent('message:read', { chatId: props.chatId })
  toast.success(t('summaryDialog.messagesMarkedRead'))
  isOpen.value = false
}

function goToMessage(msg: CoreMessage) {
  isOpen.value = false
  router.push({
    path: `/chat/${props.chatId}`,
    query: { messageId: msg.platformMessageId },
  })
}

function formatTime(timestamp: number) {
  return useDateFormat(timestamp * 1000, 'HH:mm').value
}

const canMarkRead = computed(() => {
  if (session.value.isLoading)
    return false
  if (!session.value.content)
    return false
  // Only unread-summary should allow marking unread as read.
  if (session.value.mode !== 'unread')
    return false
  return true
})
</script>

<template>
  <slot :open="open" />

  <Dialog
    v-model="isOpen"
    max-width="64rem"
  >
    <div class="h-[70vh] flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold">
          {{ t('summaryDialog.title') }}
        </h2>
      </div>

      <!-- Mode Tabs -->
      <div class="flex items-center gap-2">
        <button
          :disabled="session.isLoading"
          :class="{ 'bg-accent text-accent-foreground': activeMode === 'unread' }"
          class="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed hover:bg-accent hover:text-accent-foreground disabled:opacity-60"
          @click="triggerGenerate('unread')"
        >
          <span class="i-lucide-mail-open h-4 w-4" />
          <span>{{ t('summaryDialog.tabUnread') }}</span>
        </button>
        <button
          :disabled="session.isLoading"
          :class="{ 'bg-accent text-accent-foreground': activeMode === 'today' }"
          class="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed hover:bg-accent hover:text-accent-foreground disabled:opacity-60"
          @click="triggerGenerate('today')"
        >
          <span class="i-lucide-calendar-days h-4 w-4" />
          <span>{{ t('summaryDialog.tabToday') }}</span>
        </button>
        <button
          :disabled="session.isLoading"
          :class="{ 'bg-accent text-accent-foreground': activeMode === 'last24h' }"
          class="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed hover:bg-accent hover:text-accent-foreground disabled:opacity-60"
          @click="triggerGenerate('last24h')"
        >
          <span class="i-lucide-clock-3 h-4 w-4" />
          <span>{{ t('summaryDialog.tabLast24h') }}</span>
        </button>
      </div>

      <div class="min-h-0 flex flex-1 flex-col gap-4 md:flex-row">
        <!-- Summary Section -->
        <div class="flex flex-1 flex-col overflow-hidden rounded-lg bg-muted/30 p-4">
          <h3 class="mb-2 text-muted-foreground font-medium">
            {{ t('summaryDialog.summary') || 'Summary' }}
          </h3>
          <div v-if="session.isLoading && !session.content" class="animate-pulse space-y-3">
            <div class="h-4 w-3/4 rounded bg-muted" />
            <div class="h-4 w-1/2 rounded bg-muted" />
            <div class="h-4 w-5/6 rounded bg-muted" />
          </div>
          <div v-else class="max-w-none overflow-y-auto">
            <MarkdownRender
              :custom-id="`unread-summary-${props.chatId}`"
              :content="session.content"
            />
          </div>
        </div>

        <!-- Sources Section -->
        <div class="w-full flex flex-col overflow-hidden border rounded-lg bg-background md:w-80">
          <div class="border-b bg-muted/30 px-4 py-2 text-sm text-muted-foreground font-medium">
            {{ t('summaryDialog.sources') || 'Sources' }} ({{ session.sourceMessages.length }})
          </div>
          <div class="flex-1 overflow-y-auto p-2">
            <div v-if="session.sourceMessages.length === 0" class="py-8 text-center text-sm text-muted-foreground">
              {{ t('summaryDialog.noSources') || 'No messages' }}
            </div>
            <div
              v-for="msg in session.sourceMessages"
              :key="msg.uuid"
              class="cursor-pointer rounded p-2 text-sm hover:bg-muted/50"
              @click="goToMessage(msg)"
            >
              <div class="flex justify-between text-xs text-muted-foreground">
                <span class="text-foreground font-medium">{{ msg.fromName || msg.fromId }}</span>
                <span>{{ formatTime(msg.platformTimestamp) }}</span>
              </div>
              <div class="line-clamp-2 mt-1 text-muted-foreground">
                {{ msg.content }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2 pt-2">
        <Button
          icon="i-lucide-x"
          variant="outline"
          size="sm"
          @click="isOpen = false"
        >
          {{ t('summaryDialog.close') }}
        </Button>
        <Button
          icon="i-lucide-check"
          size="sm"
          :disabled="!canMarkRead"
          @click="markRead"
        >
          {{ t('summaryDialog.markAsRead', { count: session.sourceMessages.length }) }}
        </Button>
      </div>
    </div>
  </Dialog>
</template>
