<script setup lang="ts">
import type { CoreDialog, CoreMessage } from '@tg-search/core/types'

import { useBridge, useChatStore, useMessageStore, useSessionStore, useSettingsStore } from '@tg-search/client'
import { useWindowSize } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'

import EntityAvatar from '../../components/avatar/EntityAvatar.vue'
import SearchDialog from '../../components/SearchDialog.vue'
import SummaryDialog from '../../components/SummaryDialog.vue'
import VirtualMessageList from '../../components/VirtualMessageList.vue'

import { Button } from '../../components/ui/Button'

const { t } = useI18n()

const route = useRoute('/chat/:id')
const id = route.params.id

const chatStore = useChatStore()
const messageStore = useMessageStore()
const bridge = useBridge()
const { debugMode } = storeToRefs(useSettingsStore())
const { activeSessionId } = storeToRefs(useSessionStore())

const { sortedMessageIds, messageWindow, sortedMessageArray } = storeToRefs(messageStore)
const currentChat = computed<CoreDialog | undefined>(() => chatStore.getChat(id.toString()))

const messageLimit = ref(100)
const messageOffset = ref(0)
const { isLoading: isLoadingMessages, fetchMessages } = messageStore.useFetchMessages(id.toString(), messageLimit.value)

const { height: windowHeight } = useWindowSize()

const isLoadingOlder = ref(false)
const isLoadingNewer = ref(false)
const virtualListRef = ref<InstanceType<typeof VirtualMessageList>>()

// @ts-expect-error: TODO: already used, fix it?
const searchDialogRef = ref<InstanceType<typeof SearchDialog> | null>(null)
const isGlobalSearchOpen = ref(false)

const messageInput = ref('')
const isContextMode = ref(false)
const isContextLoading = ref(false)

const targetMessageParams = computed(() => ({
  messageId: route.query.messageId as string | undefined,
  messageUuid: route.query.messageUuid as string | undefined,
}))

// Avatar store access is not needed; ChatAvatar handles ensure and rendering

/**
 * Compute chat header avatar src via centralized avatar store.
 * Avoids typing issues by not reading transient fields on CoreDialog.
 */
// Header avatar is rendered via ChatAvatar wrapper

// Use ChatAvatar wrapper to handle ensure and rendering

// Initial load when component mounts
onMounted(async () => {
  const initialMessageId = targetMessageParams.value.messageId

  if (typeof initialMessageId === 'string' && initialMessageId.length > 0) {
    await openMessageContext(initialMessageId, targetMessageParams.value.messageUuid)
  }

  // Only load if there are no messages yet and we are not in context mode
  if (!isContextMode.value && sortedMessageIds.value.length === 0) {
    await loadOlderMessages()
  }
})

// When switching accounts while staying on the same chat route, reset the
// message window and load the dialog history for the new account.
watch(
  () => activeSessionId.value,
  async () => {
    // If we don't have a chat id (should not happen here) or component
    // is still mounting, just bail out.
    if (!id)
      return

    isContextMode.value = false
    resetPagination()
    messageStore.replaceMessages([], { chatId: id.toString(), limit: messageLimit.value })
    await loadOlderMessages()
  },
)

// Load older messages when scrolling to top
async function loadOlderMessages() {
  if (isContextMode.value)
    return
  if (isLoadingOlder.value || isLoadingMessages.value)
    return

  isLoadingOlder.value = true

  try {
    fetchMessages({
      offset: messageOffset.value,
      limit: messageLimit.value,
    }, 'older')
    messageOffset.value += messageLimit.value
  }
  finally {
    isLoadingOlder.value = false
  }
}

// Load newer messages when scrolling to bottom
async function loadNewerMessages() {
  if (isContextMode.value)
    return
  if (isLoadingNewer.value || isLoadingMessages.value)
    return

  // Get the current max message ID to fetch messages after it
  const currentMaxId = messageWindow.value?.maxId
  if (!currentMaxId || currentMaxId === -Infinity) {
    console.warn('No messages loaded yet, cannot fetch newer messages')
    return
  }

  isLoadingNewer.value = true

  try {
    // Use a separate fetch function for newer messages with minId
    fetchMessages(
      {
        offset: 0,
        limit: messageLimit.value,
        minId: currentMaxId,
      },
      'newer',
    )
  }
  finally {
    isLoadingNewer.value = false
  }
}

// Handle virtual list scroll events
function handleVirtualListScroll({ isAtTop, isAtBottom }: { scrollTop: number, isAtTop: boolean, isAtBottom: boolean }) {
  // Load older messages when scrolled to top
  if (isAtTop && !isLoadingOlder.value && !isLoadingMessages.value) {
    loadOlderMessages()
  }

  // Load newer messages when scrolled to bottom
  if (isAtBottom && !isLoadingNewer.value && !isLoadingMessages.value) {
    loadNewerMessages()
  }
}

function sendMessage() {
  if (!messageInput.value.trim())
    return

  bridge.sendEvent('message:send', {
    chatId: id.toString(),
    content: messageInput.value,
  })
  messageInput.value = ''

  toast.success(t('chat.messageSent'))
}

function resetPagination() {
  messageOffset.value = 0
}

async function openMessageContext(messageId: string, messageUuid?: string) {
  if (!messageId || isContextLoading.value)
    return

  isContextLoading.value = true
  isContextMode.value = true
  resetPagination()

  try {
    const messages = await messageStore.loadMessageContext(id.toString(), messageId, {
      before: 40,
      after: 40,
      limit: messageLimit.value,
    })

    if (messages.length === 0) {
      isContextMode.value = false
      toast.warning(t('search.noRelatedMessages'))
      await loadOlderMessages()
      return
    }

    await nextTick()

    const targetUuid = messageUuid
      ?? messages.find((msg: CoreMessage) => msg.platformMessageId === messageId)?.uuid

    if (targetUuid) {
      await nextTick()
      virtualListRef.value?.scrollToMessage(targetUuid)
    }
  }
  finally {
    isContextLoading.value = false
  }
}

watch(
  () => [targetMessageParams.value.messageId, targetMessageParams.value.messageUuid],
  async ([newMessageId, newMessageUuid], [oldMessageId]) => {
    if (newMessageId === oldMessageId)
      return

    if (typeof newMessageId === 'string' && newMessageId.length > 0) {
      await openMessageContext(newMessageId, typeof newMessageUuid === 'string' ? newMessageUuid : undefined)
    }
    else if (oldMessageId) {
      isContextMode.value = false
      resetPagination()
      messageStore.replaceMessages([], { chatId: id.toString(), limit: messageLimit.value })
      await loadOlderMessages()
    }
  },
)
</script>

<template>
  <div class="relative h-full flex flex-col bg-background">
    <!-- Debug Panel -->
    <div v-if="debugMode" class="absolute right-4 top-24 z-10 w-1/4 flex flex-col justify-left gap-2 border rounded-lg bg-card p-2 text-sm text-muted-foreground font-mono shadow-lg">
      <span>
        Height: {{ windowHeight }} / Messages: {{ sortedMessageArray.length }}
      </span>
      <span>
        IDs: {{ sortedMessageIds[0] }} - {{ sortedMessageIds[sortedMessageIds.length - 1] }}
      </span>
      <span>
        MinId: {{ messageWindow?.minId }} / MaxId: {{ messageWindow?.maxId }}
      </span>
      <span>
        Loading: {{ isLoadingMessages }} / Older: {{ isLoadingOlder }} / Newer: {{ isLoadingNewer }}
      </span>
      <span>
        Offset: {{ messageOffset }}
      </span>
      <button
        class="rounded bg-blue-500 px-2 py-1 text-xs text-white"
        :disabled="isLoadingOlder || isLoadingMessages"
        @click="loadOlderMessages"
      >
        {{ t('chat.forceLoadOlder') }}
      </button>
      <button
        class="rounded bg-green-500 px-2 py-1 text-xs text-white"
        :disabled="isLoadingNewer || isLoadingMessages"
        @click="loadNewerMessages"
      >
        {{ t('chat.forceLoadNewer') }}
      </button>
    </div>

    <!-- Chat Header -->
    <div class="flex items-center justify-between border-b bg-card/50 px-6 py-4 backdrop-blur-sm">
      <div class="flex items-center gap-3">
        <EntityAvatar
          v-if="currentChat && currentChat.id != null"
          :id="currentChat.id"
          entity="other"
          entity-type="chat"
          :file-id="currentChat?.avatarFileId"
          :name="currentChat?.name"
          size="md"
        />
        <div>
          <h2 class="text-lg font-semibold">
            {{ currentChat?.name }}
          </h2>
          <p v-if="currentChat?.id" class="text-xs text-muted-foreground">
            ID: {{ currentChat?.id }}
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <SummaryDialog :chat-id="id.toString()">
          <template #default="{ open }">
            <Button
              icon="i-lucide-sparkles"
              variant="ghost"
              size="sm"
              @click="open"
            >
              {{ t('chat.summarize') }}
            </Button>
          </template>
        </SummaryDialog>
        <Button
          icon="i-lucide-search"
          variant="ghost"
          size="sm"
          data-search-button
          @click="isGlobalSearchOpen = !isGlobalSearchOpen"
        >
          {{ t('chat.search') }}
        </Button>
      </div>
    </div>

    <!-- Messages Area with Virtual List -->
    <div class="flex-1 overflow-hidden">
      <VirtualMessageList
        ref="virtualListRef"
        :messages="sortedMessageArray"
        :on-scroll-to-top="loadOlderMessages"
        :on-scroll-to-bottom="loadNewerMessages"
        :auto-scroll-to-bottom="!isContextMode"
        @scroll="handleVirtualListScroll"
      />
    </div>

    <!-- Message Input -->
    <div class="p-4 md:p-6">
      <div class="mx-auto max-w-4xl flex items-end gap-3">
        <!-- Input container with modern design -->
        <div class="relative flex flex-1 items-center">
          <div class="absolute left-4 flex items-center gap-2">
            <button
              class="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              type="button"
              title="Emoji"
            >
              <span class="i-lucide-smile h-4 w-4" />
            </button>
          </div>
          <input
            v-model="messageInput"
            type="text"
            :placeholder="t('chat.typeAMessage')"
            class="h-14 w-full border-0 rounded-2xl bg-muted/50 px-4 py-4 pl-14 pr-14 text-base shadow-sm transition-all duration-200 focus:bg-muted placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            @keyup.enter="sendMessage"
          >
          <div class="absolute right-4 flex items-center gap-1">
            <button
              class="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              type="button"
              title="Attachment"
            >
              <span class="i-lucide-paperclip h-4 w-4" />
            </button>
          </div>
        </div>

        <!-- Send button with modern design -->
        <button
          :disabled="!messageInput.trim()"
          class="h-14 w-14 flex shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg transition-all duration-200 hover:scale-105 disabled:cursor-not-allowed hover:bg-primary/90 disabled:opacity-50 hover:shadow-xl disabled:hover:scale-100 disabled:hover:bg-primary disabled:hover:shadow-lg"
          @click="sendMessage"
        >
          <span class="i-lucide-send h-5 w-5" />
        </button>
      </div>
    </div>

    <Teleport to="body">
      <SearchDialog
        ref="searchDialogRef"
        v-model:open="isGlobalSearchOpen"
        :chat-id="id.toString()"
      >
        <template #settings>
          <div class="flex items-center">
            <input id="searchContent" type="checkbox" class="mr-1 border-border rounded">
            <label for="searchContent" class="text-sm text-gray-900 dark:text-gray-100">{{ t('chat.searchContent') }}</label>
          </div>
        </template>
      </SearchDialog>
    </Teleport>
  </div>
</template>
