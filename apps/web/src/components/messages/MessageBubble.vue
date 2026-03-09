<script setup lang="ts">
import type { CoreMessage } from '@tg-search/core/types'

import { formatMessageTimestamp, useChatStore } from '@tg-search/client'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import EntityAvatar from '../avatar/EntityAvatar.vue'
import MediaRenderer from './media/MediaRenderer.vue'

import { getChatLink, getMessageLink, getMessageWebLink, getUserLink } from '../../utils/telegram-links'
import { ContextMenu } from '../ui/ContextMenu'

const props = defineProps<{
  message: CoreMessage
}>()

const { t } = useI18n()
const chatStore = useChatStore()

const currentChat = computed(() => chatStore.getChat(props.message.chatId))

const messageTelegramLink = computed(() => {
  if (!currentChat.value)
    return null
  return getMessageLink(currentChat.value, props.message.platformMessageId)
})

const senderTelegramLink = computed(() => {
  if (!currentChat.value)
    return null
  // For channel messages, fromId is the channel itself
  if (currentChat.value.type === 'channel')
    return getChatLink(currentChat.value)

  // For all other chat types (supergroup, group, user), link to the sender's profile
  return getUserLink(props.message.fromId)
})

const chatTelegramLink = computed(() => {
  if (!currentChat.value)
    return null
  return getChatLink(currentChat.value)
})

// Context menu state
const contextMenuOpen = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)

const contextMenuItems = computed(() => {
  const items = [
    {
      label: t('messages.copyText'),
      icon: 'i-lucide-copy',
      action: () => {
        navigator.clipboard.writeText(props.message.content)
        toast.success(t('messages.copied'))
      },
    },
    {
      label: t('messages.copyMessageLink'),
      icon: 'i-lucide-link',
      action: () => {
        // Use web link (https://t.me) for clipboard — more shareable than tg://
        const webLink = currentChat.value
          ? getMessageWebLink(currentChat.value, props.message.platformMessageId)
          : null
        const link = webLink ?? `https://t.me/c/${props.message.chatId}/${props.message.platformMessageId}`
        navigator.clipboard.writeText(link)
        toast.success(t('messages.copied'))
      },
    },
  ]

  if (messageTelegramLink.value) {
    items.push({
      label: t('messages.openInTelegram'),
      icon: 'i-lucide-external-link',
      action: () => {
        window.open(messageTelegramLink.value!, '_self')
      },
    })
  }

  if (senderTelegramLink.value) {
    items.push({
      label: t('messages.openProfileInTelegram'),
      icon: 'i-lucide-user',
      action: () => {
        window.open(senderTelegramLink.value!, '_self')
      },
    })
  }

  if (chatTelegramLink.value) {
    items.push({
      label: t('messages.openChatInTelegram'),
      icon: 'i-lucide-message-circle',
      action: () => {
        window.open(chatTelegramLink.value!, '_self')
      },
    })
  }

  return items
})

function showContextMenu(e: MouseEvent | PointerEvent) {
  e.preventDefault()
  contextMenuX.value = e.clientX
  contextMenuY.value = e.clientY
  contextMenuOpen.value = true
}

// Long-press support for mobile
let longPressTimer: ReturnType<typeof setTimeout> | null = null

function onPointerDown(e: PointerEvent) {
  // Only handle touch events for long-press (mouse uses contextmenu event)
  if (e.pointerType !== 'touch')
    return

  longPressTimer = setTimeout(() => {
    showContextMenu(e)
    longPressTimer = null
  }, 500)
}

function cancelLongPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}
</script>

<template>
  <div
    class="group mx-3 my-1 flex items-start gap-3 rounded-xl p-3 transition-all duration-200 md:mx-4 md:gap-4 hover:bg-accent/50"
    @contextmenu="showContextMenu"
    @pointerdown="onPointerDown"
    @pointerup="cancelLongPress"
    @pointermove="cancelLongPress"
    @pointercancel="cancelLongPress"
  >
    <a
      class="shrink-0 pt-0.5"
      :class="senderTelegramLink ? 'cursor-pointer' : ''"
      :href="senderTelegramLink ?? undefined"
      target="_blank"
      rel="noopener noreferrer"
      @click.stop
    >
      <EntityAvatar
        :id="message.fromId"
        entity="other"
        entity-type="user"
        :name="message.fromName"
        size="md"
      />
    </a>
    <div class="min-w-0 flex-1">
      <div class="mb-1.5 flex items-baseline gap-2">
        <span class="truncate text-sm text-foreground font-semibold">{{ message.fromName }}</span>
        <span class="shrink-0 text-xs text-muted-foreground">{{ formatMessageTimestamp(message.platformTimestamp) }}</span>
      </div>

      <div class="prose prose-sm max-w-none text-foreground/90">
        <MediaRenderer :message="message" />
      </div>

      <!-- Message ID badge (hidden by default, shown on hover) -->
      <div class="mt-1.5 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
        <span class="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          <span class="i-lucide-hash mr-1 h-3 w-3" />
          {{ message.platformMessageId }}
        </span>
      </div>
    </div>

    <ContextMenu
      v-model:open="contextMenuOpen"
      :items="contextMenuItems"
      :x="contextMenuX"
      :y="contextMenuY"
    />
  </div>
</template>
