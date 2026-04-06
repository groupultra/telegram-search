<script setup lang="ts">
import type { CoreDialog, CoreMessage } from '@tg-search/core/types'

import { useBridge, useChatStore, useMessageStore, useSessionStore, useSettingsStore } from '@tg-search/client'
import { CoreEventType } from '@tg-search/core'
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '../../components/ui/ContextMenu'
import { Input } from '../../components/ui/Input'
import { getChatLink } from '../../utils/telegram-links'

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
const chatTelegramLink = computed(() => {
  if (!currentChat.value)
    return null
  return getChatLink(currentChat.value)
})

// Fetch batch size (per request) and window capacity (total in-memory) are intentionally
// separated. A large window prevents cleanup from evicting messages the user is currently
// viewing, which was the root cause of scroll drift when loading older messages.
const messageFetchLimit = 50
const messageWindowSize = 500
const messageOffset = ref(0)
const { isLoading: isLoadingMessages, fetchMessages } = messageStore.useFetchMessages(id.toString(), messageWindowSize)

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
    messageStore.replaceMessages([], { chatId: id.toString(), limit: messageWindowSize })
    await loadOlderMessages()
  },
)

// Load older messages when scrolling to top.
// Returns a status so VirtualMessageList's top-load state machine can
// distinguish a real "no more messages" from a skipped request.
async function loadOlderMessages(): Promise<'fetched' | 'skipped'> {
  if (isContextMode.value)
    return 'skipped'
  if (isLoadingOlder.value)
    return 'skipped'

  isLoadingOlder.value = true

  try {
    const currentOffset = messageOffset.value
    messageOffset.value += messageFetchLimit
    await fetchMessages({
      offset: currentOffset,
      limit: messageFetchLimit,
    }, 'older')
    return 'fetched'
  }
  finally {
    isLoadingOlder.value = false
  }
}

// Load newer messages when scrolling to bottom
async function loadNewerMessages(): Promise<'fetched' | 'skipped'> {
  if (isContextMode.value)
    return 'skipped'
  if (isLoadingNewer.value)
    return 'skipped'

  // Get the current max message ID to fetch messages after it
  const currentMaxId = messageWindow.value?.maxId
  if (!currentMaxId || currentMaxId === -Infinity) {
    console.warn('No messages loaded yet, cannot fetch newer messages')
    return 'skipped'
  }

  isLoadingNewer.value = true

  try {
    await fetchMessages(
      {
        offset: 0,
        limit: messageFetchLimit,
        minId: currentMaxId,
      },
      'newer',
    )
    return 'fetched'
  }
  finally {
    isLoadingNewer.value = false
  }
}

function sendMessage() {
  if (!messageInput.value.trim())
    return

  bridge.sendEvent(CoreEventType.MessageSend, {
    chatId: id.toString(),
    content: messageInput.value,
  })
  messageInput.value = ''

  toast.success(t('chat.messageSent'))
}

function openTelegram() {
  if (chatTelegramLink.value) {
    window.open(chatTelegramLink.value, '_self')
  }
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
      limit: messageWindowSize,
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
      messageStore.replaceMessages([], { chatId: id.toString(), limit: messageWindowSize })
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
        Messages: {{ sortedMessageArray.length }}
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
      <Button
        size="sm"
        :disabled="isLoadingOlder || isLoadingMessages"
        @click="loadOlderMessages"
      >
        {{ t('chat.forceLoadOlder') }}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        :disabled="isLoadingNewer || isLoadingMessages"
        @click="loadNewerMessages"
      >
        {{ t('chat.forceLoadNewer') }}
      </Button>
    </div>

    <!-- Chat Header -->
    <div class="sticky top-0 z-20 h-14 flex items-center justify-between gap-2 border-b bg-background/80 px-4 py-0 backdrop-blur-md md:h-16 supports-[backdrop-filter]:bg-background/60 md:px-6">
      <div class="min-w-0 flex flex-1 items-center gap-3">
        <ContextMenu v-if="currentChat && currentChat.id != null">
          <ContextMenuTrigger>
            <div :class="chatTelegramLink ? 'cursor-context-menu' : ''">
              <EntityAvatar
                :id="currentChat.id"
                entity="other"
                entity-type="chat"
                :file-id="currentChat?.avatarFileId"
                :name="currentChat?.name"
                size="md"
              />
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent v-if="chatTelegramLink">
            <ContextMenuItem @select="openTelegram">
              <span class="i-lucide-external-link mr-2 h-4 w-4" />
              {{ t('messages.openInTelegram') }}
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        <div class="min-w-0">
          <h2 class="truncate text-lg font-semibold">
            {{ currentChat?.name }}
          </h2>
          <p v-if="currentChat?.id" class="truncate text-xs text-muted-foreground">
            ID: {{ currentChat?.id }}
          </p>
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-1">
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
          size="icon"
          class="h-9 w-9"
          :aria-label="t('chat.search')"
          :title="t('chat.search')"
          data-search-button
          @click="isGlobalSearchOpen = !isGlobalSearchOpen"
        />
      </div>
    </div>

    <div class="flex-1 overflow-hidden">
      <VirtualMessageList
        ref="virtualListRef"
        :messages="sortedMessageArray"
        :on-scroll-to-top="loadOlderMessages"
        :on-scroll-to-bottom="loadNewerMessages"
        :auto-scroll-to-bottom="!isContextMode"
        :debug="debugMode"
      />
    </div>

    <!-- Message Input -->
    <div class="absolute bottom-6 left-0 right-0 z-20 px-4 md:bottom-6 md:px-6">
      <div class="mx-auto max-w-4xl flex items-end gap-3 border border-border/65 rounded-2xl bg-background/90 p-2 shadow-sm backdrop-blur-xl transition-all duration-200 focus-within:border-primary/35 hover:border-border focus-within:bg-background hover:bg-background focus-within:ring-2 focus-within:ring-primary/15">
        <!-- Input container with modern design -->
        <div class="relative flex flex-1 items-center">
          <div class="absolute left-2 flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              class="h-10 w-10 rounded-full text-muted-foreground hover:text-foreground"
              title="Emoji"
            >
              <span class="i-lucide-smile h-5 w-5" />
            </Button>
          </div>
          <Input
            v-model="messageInput"
            type="text"
            :placeholder="t('chat.typeAMessage')"
            class="h-10 w-full border-transparent bg-transparent pl-14 pr-14 text-base text-foreground shadow-none transition-all md:h-14 placeholder:text-foreground/45 focus-visible:ring-0"
            @keyup.enter="sendMessage"
          />
          <div class="absolute right-2 flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              class="h-10 w-10 rounded-full text-muted-foreground hover:text-foreground"
              title="Attachment"
            >
              <span class="i-lucide-paperclip h-5 w-5" />
            </Button>
          </div>
        </div>

        <!-- Send button with modern design -->
        <Button
          :disabled="!messageInput.trim()"
          size="icon"
          class="h-10 w-10 shrink-0 rounded-xl shadow-sm transition-transform md:h-14 md:w-14 active:scale-95 hover:scale-105"
          @click="sendMessage"
        >
          <span class="i-lucide-send ml-0.5 mt-0.5 h-5 w-5 md:h-6 md:w-6" />
        </Button>
      </div>
    </div>

    <SearchDialog
      ref="searchDialogRef"
      v-model:open="isGlobalSearchOpen"
      :chat-id="id.toString()"
    />
  </div>
</template>
