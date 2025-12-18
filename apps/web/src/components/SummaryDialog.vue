<script setup lang="ts">
import type { CoreMessage } from '@tg-search/core'

import { useAccountStore, useBridgeStore } from '@tg-search/client'
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { streamText } from 'xsai'

import Dialog from './ui/Dialog.vue'

import { Button } from './ui/Button'

const props = defineProps<{
  chatId: string
}>()

const isOpen = ref(false)
const isLoading = ref(false)
const summary = ref('')
const unreadMessages = ref<CoreMessage[]>([])
const bridge = useBridgeStore()
const account = useAccountStore()

async function open() {
  isOpen.value = true
  summary.value = ''
  unreadMessages.value = []
  isLoading.value = true

  // Calculate start of today (00:00:00)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfTodayTimestamp = Math.floor(startOfToday.getTime() / 1000)

  bridge.sendEvent('message:fetch:unread', {
    chatId: props.chatId,
    startTime: startOfTodayTimestamp,
  })

  try {
    const data = await bridge.waitForEvent('message:unread-data')
    // The event listener returns { messages: ... }
    // But bridge.waitForEvent returns data directly (WsEventToClientData)
    // which is { messages: CoreMessage[] }
    unreadMessages.value = data.messages

    if (data.messages.length === 0) {
      toast.info('No unread messages')
      isLoading.value = false
      // Keep dialog open to show "No unread messages" state or close?
      // User might expect to see that.
      summary.value = 'No unread messages found.'
      return
    }

    await generateSummary(data.messages)
  }
  catch (e) {
    toast.error('Failed to fetch messages')
    isLoading.value = false
    console.error(e)
  }
}

async function generateSummary(messages: CoreMessage[]) {
  // Check for API Key
  const settings = account.accountSettings?.llm
  const apiKey = settings?.apiKey

  if (!apiKey) {
    toast.error('No LLM API Key found in settings')
    summary.value = 'Please configure LLM API Key in Settings.'
    isLoading.value = false
    return
  }

  const baseURL = settings?.apiBase || 'https://api.openai.com/v1'
  const model = settings?.model || 'gpt-4o-mini'

  const content = messages.map((m) => {
    const name = m.fromName || (m.fromId ? `User ${m.fromId}` : 'Unknown')
    return `${name}: ${m.content}`
  }).join('\n')

  try {
    // Use xsAI streaming API (streamText)
    const { textStream } = streamText({
      apiKey,
      baseURL,
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Summarize the following telegram messages concisely with Chinese.' },
        { role: 'user', content },
      ],
      model,
    })

    isLoading.value = false
    for await (const text of textStream) {
      summary.value += text
    }
  }
  catch (e) {
    console.error(e)
    toast.error('Summary generation failed')
    summary.value += '\n(Generation failed)'
    isLoading.value = false
  }
}

async function markRead() {
  bridge.sendEvent('message:read', { chatId: props.chatId })
  toast.success('Messages marked as read')
  isOpen.value = false
}
</script>

<template>
  <slot :open="open" />

  <Dialog
    v-model="isOpen"
    max-width="48rem"
  >
    <div class="space-y-4">
      <h2 class="text-lg font-bold">
        Unread Summary
      </h2>
      <div v-if="isLoading" class="animate-pulse space-y-3">
        <div class="h-4 w-3/4 rounded bg-muted" />
        <div class="h-4 w-1/2 rounded bg-muted" />
        <div class="h-4 w-5/6 rounded bg-muted" />
      </div>

      <div v-else class="prose dark:prose-invert max-h-[60vh] max-w-none overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/30 p-4">
        {{ summary }}
      </div>

      <div class="flex justify-end gap-2 pt-2">
        <Button variant="outline" @click="isOpen = false">
          Close
        </Button>
        <Button :disabled="isLoading || !summary || summary === 'No unread messages found.'" @click="markRead">
          Mark as Read
        </Button>
      </div>
    </div>
  </Dialog>
</template>
