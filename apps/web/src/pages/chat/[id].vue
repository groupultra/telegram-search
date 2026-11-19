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
import MessageComposer from '../../components/MessageComposer.vue'
import SummaryDialog from '../../components/SummaryDialog.vue'
import VirtualMessageList from '../../components/VirtualMessageList.vue'

import { ActionIcon } from '../../components/ui/ActionIcon'
import { Button } from '../../components/ui/Button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '../../components/ui/ContextMenu'
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
const { isLoading: isLoadingMessages, fetchMessages } = messageStore.useFetchMessages(id.toString(), messageWindowSize)

const isLoadingOlder = ref(false)
const isLoadingNewer = ref(false)

const virtualListRef = ref<InstanceType<typeof VirtualMessageList>>()

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
    await fetchMessages(messageFetchLimit, 'older')
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
    await fetchMessages(messageFetchLimit, 'newer')
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

function openGlobalSearch() {
  window.dispatchEvent(new Event('tg-search:open-global-search'))
}

async function openMessageContext(messageId: string, messageUuid?: string) {
  if (!messageId || isContextLoading.value)
    return

  isContextLoading.value = true
  isContextMode.value = true

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
      messageStore.replaceMessages([], { chatId: id.toString(), limit: messageWindowSize })
      await loadOlderMessages()
    }
  },
)
</script>

<template>
  <div class="relative h-full flex flex-col bg-container">
    <!-- Debug Panel -->
    <div v-if="debugMode" class="absolute right-4 top-18 z-30 w-1/4 flex flex-col justify-left gap-2 rounded-md bg-elevated p-3 text-xs text-fg-2 font-mono shadow-popup">
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
      <Button
        variant="primary"
        :disabled="isLoadingOlder || isLoadingMessages"
        @click="loadOlderMessages"
      >
        {{ t('chat.forceLoadOlder') }}
      </Button>
      <Button
        variant="fill"
        :disabled="isLoadingNewer || isLoadingMessages"
        @click="loadNewerMessages"
      >
        {{ t('chat.forceLoadNewer') }}
      </Button>
    </div>

    <!-- Chat Header -->
    <div class="sticky top-0 z-20 h-14 flex shrink-0 items-center justify-between gap-2 border-b border-line-2 bg-container px-3 md:px-4">
      <div class="min-w-0 flex flex-1 items-center gap-3">
        <ActionIcon
          icon="i-lucide-chevron-left"
          class="shrink-0 md:hidden"
          :title="t('common.back')"
          @click="$router.push('/chats')"
        />
        <ContextMenu v-if="currentChat && currentChat.id != null">
          <ContextMenuTrigger>
            <div :class="chatTelegramLink ? 'cursor-context-menu' : ''">
              <EntityAvatar
                :id="currentChat.id"
                entity="other"
                entity-type="chat"
                :file-id="currentChat?.avatarFileId"
                :name="currentChat?.name"
                size="sm"
              />
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent v-if="chatTelegramLink">
            <ContextMenuItem @select="openTelegram">
              <span class="i-lucide-external-link h-4 w-4 text-fg-2" />
              {{ t('messages.openInTelegram') }}
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        <div class="min-w-0">
          <h2 class="truncate text-sm text-fg font-semibold leading-5">
            {{ currentChat?.name }}
          </h2>
          <p v-if="currentChat?.id" class="truncate text-xs text-fg-3 leading-4">
            ID {{ currentChat?.id }}
          </p>
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <SummaryDialog :chat-id="id.toString()">
          <template #default="{ open }">
            <Button icon="i-lucide-sparkles" @click="open">
              {{ t('chat.summarize') }}
            </Button>
          </template>
        </SummaryDialog>
        <ActionIcon
          icon="i-lucide-search"
          :title="t('chat.search')"
          data-search-button
          @click="openGlobalSearch"
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
    <div class="absolute bottom-4 left-0 right-0 z-20 px-3 md:px-4">
      <MessageComposer
        v-model="messageInput"
        :placeholder="t('chat.typeAMessage')"
        @keyup.shift.enter="sendMessage"
        @send="sendMessage"
      >
        <template #prefix>
          <ActionIcon icon="i-lucide-smile" title="Emoji" />
        </template>
        <template #actions>
          <ActionIcon icon="i-lucide-paperclip" title="Attachment" />
        </template>
      </MessageComposer>
    </div>
  </div>
</template>
