<script setup lang="ts">
import type { CoreDialog, CoreMessage } from '@tg-search/core/types'

import { useBridgeStore, useChatStore, useMessageStore, useSettingsStore } from '@tg-search/client'
import { useWindowSize } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'

import SearchDialog from '../../components/SearchDialog.vue'
import { Button } from '../../components/ui/Button'
import VirtualMessageList from '../../components/VirtualMessageList.vue'

const { t } = useI18n()

const route = useRoute('/chat/:id')
const id = route.params.id

const chatStore = useChatStore()
const messageStore = useMessageStore()
const websocketStore = useBridgeStore()
const { debugMode } = storeToRefs(useSettingsStore())

const { sortedMessageIds, messageWindow, sortedMessageArray } = storeToRefs(messageStore)
const currentChat = computed<CoreDialog | undefined>(() => chatStore.getChat(id.toString()))

const messageLimit = ref(100)
const messageOffset = ref(0)
const { isLoading: isLoadingMessages, fetchMessages } = messageStore.useFetchMessages(id.toString(), messageLimit.value)

const { height: windowHeight } = useWindowSize()

const isLoadingOlder = ref(false)
const isLoadingNewer = ref(false)
const virtualListRef = ref<InstanceType<typeof VirtualMessageList>>()

const searchDialogRef = ref<InstanceType<typeof SearchDialog> | null>(null)
const isGlobalSearchOpen = ref(false)

const messageInput = ref('')
const isContextMode = ref(false)
const isContextLoading = ref(false)

const targetMessageParams = computed(() => ({
  messageId: route.query.messageId as string | undefined,
  messageUuid: route.query.messageUuid as string | undefined,
}))

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
    // eslint-disable-next-line no-console
    console.log('No messages loaded yet, cannot fetch newer messages')
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

  websocketStore.sendEvent('message:send', {
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
  <div class="relative h-full flex flex-col">
    <!-- Debug Panel -->
    <div v-if="debugMode" class="absolute right-4 top-24 w-1/4 flex flex-col justify-left gap-2 rounded-lg bg-neutral-200 p-2 text-sm text-gray-500 font-mono dark:bg-neutral-800">
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
    <div class="flex items-center justify-between border-b p-4 dark:border-gray-700">
      <h2 class="text-xl text-gray-900 font-semibold dark:text-gray-100">
        {{ [currentChat?.name, currentChat?.id].filter(Boolean).join(' @ ') }}
      </h2>
      <Button
        icon="i-lucide-search"
        data-search-button
        @click="isGlobalSearchOpen = !isGlobalSearchOpen"
      >
        {{ t('chat.search') }}
      </Button>
    </div>

    <!-- Messages Area with Virtual List -->
    <div class="flex-1 overflow-hidden bg-white dark:bg-gray-900">
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
    <div class="border-t from-background/95 to-background bg-gradient-to-b p-4 backdrop-blur dark:border-gray-700 supports-[backdrop-filter]:bg-background/60">
      <div class="mx-auto max-w-4xl flex items-end gap-2">
        <!-- Input container with modern design -->
        <div class="relative flex flex-1 items-center">
          <input
            v-model="messageInput"
            type="text"
            :placeholder="t('chat.typeAMessage')"
            class="h-12 w-full border rounded-xl bg-background px-4 py-3 pr-12 text-sm shadow-sm transition-all duration-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
            @keyup.enter="sendMessage"
          >
          <!-- Emoji/Attachment buttons (optional, can be expanded later) -->
          <!-- <div class="absolute right-3 flex items-center gap-1">
            <button
              class="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              type="button"
              title="More options"
            >
              <span class="i-lucide-paperclip h-4 w-4" />
            </button>
          </div> -->
        </div>

        <!-- Send button with modern design -->
        <button
          :disabled="!messageInput.trim()"
          class="h-12 w-12 flex flex-shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-all duration-200 disabled:cursor-not-allowed hover:bg-primary/90 disabled:opacity-50 hover:shadow-md disabled:hover:bg-primary disabled:hover:shadow-sm"
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
