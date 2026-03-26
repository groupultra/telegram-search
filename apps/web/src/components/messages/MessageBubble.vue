<script setup lang="ts">
import type { CoreMessage } from '@tg-search/core/types'

import { useChatStore, useMessageStore, useSessionStore } from '@tg-search/client'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import EntityAvatar from '../avatar/EntityAvatar.vue'
import MediaRenderer from './media/MediaRenderer.vue'

import { getChatLink, getMessageLink, getMessageWebLink, getUserLink } from '../../utils/telegram-links'
import { ContextMenu } from '../ui/ContextMenu'

const props = defineProps<{
  message: CoreMessage
  previousMessage?: CoreMessage
  nextMessage?: CoreMessage
}>()

const { t } = useI18n()
const chatStore = useChatStore()
const messageStore = useMessageStore()
const sessionStore = useSessionStore()
const displayedContent = ref(props.message.content)
const bubbleStretchState = ref<'idle' | 'active'>('idle')
let bubbleStretchTimer: ReturnType<typeof setTimeout> | null = null

const currentChat = computed(() => chatStore.getChat(props.message.chatId))
const currentUserId = computed(() => sessionStore.activeSession?.me?.id?.toString())

const isOwnMessage = computed(() => {
  return !!currentUserId.value && currentUserId.value === props.message.fromId
})

function isGroupedMessage(base: CoreMessage, sibling?: CoreMessage) {
  if (!sibling) {
    return false
  }

  if (base.fromId !== sibling.fromId) {
    return false
  }

  const delta = Math.abs(base.platformTimestamp - sibling.platformTimestamp)
  return delta <= 5 * 60
}

const isGroupedWithPrevious = computed(() => isGroupedMessage(props.message, props.previousMessage))
const isGroupedWithNext = computed(() => isGroupedMessage(props.message, props.nextMessage))
const showSenderName = computed(() => !isOwnMessage.value && !isGroupedWithPrevious.value)
const showAvatar = computed(() => !isOwnMessage.value && !isGroupedWithNext.value)

const senderAccentClass = computed(() => {
  const accents = [
    'message-sender-accent-0',
    'message-sender-accent-1',
    'message-sender-accent-2',
    'message-sender-accent-3',
    'message-sender-accent-4',
    'message-sender-accent-5',
  ]

  const seed = Array.from(props.message.fromName || '')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0)

  return accents[seed % accents.length]
})

const primaryMediaType = computed(() => props.message.media?.[0]?.type)
const isMediaOnlyMessage = computed(() => {
  const hasText = !!props.message.content?.trim()
  if (hasText) {
    return false
  }

  return primaryMediaType.value === 'photo' || primaryMediaType.value === 'sticker'
})

const usesBubbleShell = computed(() => !isMediaOnlyMessage.value)
const isUpdatedMessage = computed(() => {
  return messageStore.isMessageEdited(props.message)
})
const isCompactTextMessage = computed(() => {
  const hasMedia = !!props.message.media?.length
  const text = props.message.content?.trim() ?? ''

  if (!text || hasMedia) {
    return false
  }

  return !text.includes('\n') && text.length <= 36
})

const messageBodyPaddingClass = computed(() => {
  if (!usesBubbleShell.value) {
    return ''
  }

  if (isUpdatedMessage.value) {
    return isCompactTextMessage.value ? 'pr-23 pb-0.75' : 'pr-22 pb-2'
  }

  return isCompactTextMessage.value ? 'pr-11 pb-0.75' : 'pr-10 pb-2'
})

const messageSpacingClass = computed(() => {
  if (!props.previousMessage) {
    return 'mt-2'
  }

  return isGroupedWithPrevious.value ? 'mt-0.5' : 'mt-2.5'
})

const bubbleShapeClass = computed(() => {
  if (isOwnMessage.value) {
    return [
      isGroupedWithPrevious.value ? 'rounded-tr-sm' : 'rounded-tr-[1.35rem]',
      isGroupedWithNext.value ? 'rounded-br-xl' : 'rounded-br-md',
      'rounded-tl-[1.35rem]',
      'rounded-bl-[1.35rem]',
    ]
  }

  return [
    isGroupedWithPrevious.value ? 'rounded-tl-sm' : 'rounded-tl-[1.35rem]',
    isGroupedWithNext.value ? 'rounded-bl-xl' : 'rounded-bl-md',
    'rounded-tr-[1.35rem]',
    'rounded-br-[1.35rem]',
  ]
})

const tailClass = computed(() => {
  if (isOwnMessage.value) {
    return 'message-bubble-tail--own'
  }

  return 'message-bubble-tail--incoming'
})

const bubbleTime = computed(() => {
  const date = new Date(props.message.platformTimestamp * 1000)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
})

const bubbleMetaClass = computed(() => {
  if (!usesBubbleShell.value) {
    return ''
  }

  return isCompactTextMessage.value
    ? 'absolute right-2.5 bottom-1.25'
    : 'absolute right-2.5 bottom-1.5'
})

const isDeletingMessage = computed(() => messageStore.isMessageDeleting(props.message))
const animatedMessage = computed(() => ({
  ...props.message,
  content: displayedContent.value,
}))
const bubbleStretchClass = computed(() => {
  if (bubbleStretchState.value !== 'active') {
    return ''
  }

  return isOwnMessage.value
    ? 'origin-right bubble-stretch'
    : 'origin-left bubble-stretch'
})

watch(
  () => props.message.content,
  (newContent, oldContent) => {
    if (oldContent === undefined || newContent === oldContent) {
      displayedContent.value = newContent
      return
    }

    if (bubbleStretchTimer) {
      clearTimeout(bubbleStretchTimer)
      bubbleStretchTimer = null
    }

    displayedContent.value = newContent
    bubbleStretchState.value = 'active'
    bubbleStretchTimer = setTimeout(() => {
      bubbleStretchState.value = 'idle'
      bubbleStretchTimer = null
    }, 260)
  },
)

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
    class="group mx-1.5 flex items-end gap-2 px-3 py-0 md:mx-3"
    :class="[
      isOwnMessage ? 'justify-end' : 'justify-start',
      isDeletingMessage ? 'pointer-events-none opacity-0 scale-[0.96] blur-[1px] transition-all duration-300 ease-out' : '',
    ]"
    @contextmenu="showContextMenu"
    @pointerdown="onPointerDown"
    @pointerup="cancelLongPress"
    @pointermove="cancelLongPress"
    @pointercancel="cancelLongPress"
  >
    <div
      v-if="!isOwnMessage"
      class="h-10 w-10 shrink-0"
    >
      <a
        v-if="showAvatar"
        class="block"
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
    </div>

    <div
      class="relative max-w-[min(82vw,38rem)] min-w-0 flex flex-col"
      :class="[isOwnMessage ? 'items-end' : 'items-start', messageSpacingClass]"
    >
      <div
        class="relative max-w-full min-w-0 w-fit transition-transform duration-150 group-hover:translate-y-[-1px]"
        :class="[
          bubbleStretchClass,
          usesBubbleShell
            ? [
              'message-bubble-shell px-3.5 py-1.5 shadow-sm',
              bubbleShapeClass,
              isOwnMessage
                ? 'message-bubble-shell--own'
                : 'message-bubble-shell--incoming',
              showSenderName ? 'pt-1.5' : '',
            ]
            : 'message-bubble-plain px-0 py-0 shadow-none',
        ]"
      >
        <span
          v-if="usesBubbleShell && !isOwnMessage && !isGroupedWithNext"
          class="message-bubble-tail [clip-path:polygon(100%_0,100%_100%,0_100%)] absolute bottom-[0.18rem] left-0 z-0 h-3.5 w-3.5 rounded-bl-[0.95rem] -translate-x-[0.52rem]"
          :class="tailClass"
        />

        <span
          v-if="usesBubbleShell && isOwnMessage && !isGroupedWithNext"
          class="message-bubble-tail [clip-path:polygon(0_0,100%_100%,0_100%)] absolute bottom-[0.18rem] right-0 z-0 h-3.5 w-3.5 translate-x-[0.52rem] rounded-br-[0.95rem]"
          :class="tailClass"
        />

        <div
          v-if="showSenderName"
          class="relative z-10 mb-0.5 flex items-center gap-2 text-[14px] font-semibold leading-[1.15]"
        >
          <span class="truncate" :class="senderAccentClass">{{ message.fromName }}</span>
        </div>

        <div
          class="relative z-10 max-w-full min-w-0 text-[14px] leading-[1.35]"
          :class="[
            messageBodyPaddingClass,
          ]"
        >
          <MediaRenderer :message="animatedMessage" />
        </div>

        <div
          v-if="usesBubbleShell"
          class="message-bubble-meta pointer-events-none z-10 flex items-center gap-1.5 text-[10px] leading-none opacity-80"
          :class="bubbleMetaClass"
        >
          <span v-if="isUpdatedMessage">{{ t('messages.updated') }}</span>
          <span>{{ bubbleTime }}</span>
        </div>
      </div>

      <div
        v-if="!usesBubbleShell"
        class="message-bubble-meta mt-1 px-1 text-[11px] leading-none opacity-80"
      >
        {{ bubbleTime }}
      </div>

      <div
        class="pointer-events-none absolute left-full top-1/2 z-10 ml-2 flex items-center gap-2 opacity-0 transition-opacity duration-150 -translate-y-1/2 group-hover:opacity-100"
      >
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

<style scoped>
@keyframes message-bubble-stretch {
  0% {
    transform: scaleX(1);
  }

  45% {
    transform: scaleX(1.045);
  }

  100% {
    transform: scaleX(1);
  }
}

.bubble-stretch {
  animation: message-bubble-stretch 260ms ease-out;
}

.message-bubble-shell {
  --message-bubble-bg: #dbe8f7;
  --message-bubble-fg: #14263a;
  --message-bubble-shadow: 0 10px 24px rgba(125, 146, 175, 0.18);
  background: var(--message-bubble-bg);
  color: var(--message-bubble-fg);
  box-shadow: var(--message-bubble-shadow);
}

.message-bubble-shell--own {
  --message-bubble-bg: #bcdfff;
  --message-bubble-fg: #0f2740;
  --message-bubble-shadow: 0 10px 24px rgba(97, 135, 179, 0.22);
}

.message-bubble-shell--incoming {
  --message-bubble-bg: #dbe8f7;
  --message-bubble-fg: #14263a;
  --message-bubble-shadow: 0 10px 24px rgba(125, 146, 175, 0.18);
}

.message-bubble-tail {
  background: var(--message-bubble-bg);
}

.message-bubble-tail--own {
  --message-bubble-bg: #bcdfff;
}

.message-bubble-tail--incoming {
  --message-bubble-bg: #dbe8f7;
}

.message-bubble-meta {
  color: #526171;
}

.message-bubble-plain {
  color: #1f2a37;
}

.message-sender-accent-0 {
  color: #38bdf8;
}

.message-sender-accent-1 {
  color: #34d399;
}

.message-sender-accent-2 {
  color: #a78bfa;
}

.message-sender-accent-3 {
  color: #fbbf24;
}

.message-sender-accent-4 {
  color: #fb7185;
}

.message-sender-accent-5 {
  color: #22d3ee;
}

:global(.dark) .message-bubble-shell--own {
  --message-bubble-bg: #2d5f87;
  --message-bubble-fg: #fff;
  --message-bubble-shadow: 0 10px 30px rgba(45, 95, 135, 0.22);
}

:global(.dark) .message-bubble-shell--incoming {
  --message-bubble-bg: #15283a;
  --message-bubble-fg: #edf5ff;
  --message-bubble-shadow: 0 10px 30px rgba(4, 12, 22, 0.28);
}

:global(.dark) .message-bubble-tail--own {
  --message-bubble-bg: #2d5f87;
}

:global(.dark) .message-bubble-tail--incoming {
  --message-bubble-bg: #15283a;
}

:global(.dark) .message-bubble-meta {
  color: rgb(255 255 255 / 0.7);
}

:global(.dark) .message-bubble-plain {
  color: #edf5ff;
}
</style>
