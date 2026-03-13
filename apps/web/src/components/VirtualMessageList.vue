<script setup lang="ts">
import type { CoreMessage } from '@tg-search/core'

import { VList } from 'virtua/vue'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import MessageBubble from './messages/MessageBubble.vue'

interface Props {
  messages: CoreMessage[]
  onScrollToTop?: () => void
  onScrollToBottom?: () => void
  autoScrollToBottom?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  autoScrollToBottom: true,
})

const emit = defineEmits<{
  scroll: [{ scrollTop: number, isAtTop: boolean, isAtBottom: boolean }]
}>()

const { t } = useI18n()

const vListRef = ref<InstanceType<typeof VList>>()

// Track scroll state
const isScrolling = ref(false)
const scrollTop = ref(0)
let scrollTimer: ReturnType<typeof setTimeout> | null = null

// Container height calculation
// const containerHeight = computed(() => Math.max(windowHeight.value - 200, 400))

// Track if we're at top/bottom to prevent repeated callbacks
const isAtTop = ref(false)
const isAtBottom = ref(true)
let lastMessageCount = 0

type MessageListItem
  = | { type: 'separator', id: string, label: string }
    | { type: 'message', id: string, message: CoreMessage, messageIndex: number }

function toDayKey(timestamp: number) {
  const date = new Date(timestamp * 1000)
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

function formatDaySeparator(timestamp: number) {
  const date = new Date(timestamp * 1000)
  const now = new Date()

  const isSameDay = now.getFullYear() === date.getFullYear()
    && now.getMonth() === date.getMonth()
    && now.getDate() === date.getDate()

  if (isSameDay) {
    return '今天'
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: now.getFullYear() === date.getFullYear() ? undefined : 'numeric',
  }).format(date)
}

const renderItems = computed<MessageListItem[]>(() => {
  const items: MessageListItem[] = []
  let lastDayKey = ''

  props.messages.forEach((message, messageIndex) => {
    const dayKey = toDayKey(message.platformTimestamp)

    if (dayKey !== lastDayKey) {
      items.push({
        type: 'separator',
        id: `separator:${dayKey}`,
        label: formatDaySeparator(message.platformTimestamp),
      })
      lastDayKey = dayKey
    }

    items.push({
      type: 'message',
      id: message.uuid,
      message,
      messageIndex,
    })
  })

  return items
})

function getPreviousMessage(index: number) {
  return index > 0 ? props.messages[index - 1] : undefined
}

function getNextMessage(index: number) {
  return index < props.messages.length - 1 ? props.messages[index + 1] : undefined
}

// Watch for message changes to maintain scroll position
watch(() => props.messages, async (newMessages, oldMessages) => {
  const newMessageCount = newMessages.length
  const oldMessageCount = oldMessages?.length ?? 0
  const hasNewMessages = newMessageCount > lastMessageCount

  // If messages were added at the top (loading older messages)
  if (newMessageCount > oldMessageCount && !isAtBottom.value) {
    // Reset isAtTop flag so the callback can be triggered again when scrolling to top
    isAtTop.value = false
  }

  // Auto scroll to bottom when new messages arrive at the end
  if (hasNewMessages && props.autoScrollToBottom && isAtBottom.value) {
    await nextTick()
    scrollToBottom()
  }

  lastMessageCount = newMessageCount
}, { flush: 'post' })

// Handle scroll events and emit status
function onScroll(offset: number) {
  scrollTop.value = offset
  isScrolling.value = true

  // Clear existing timer
  if (scrollTimer) {
    clearTimeout(scrollTimer)
  }

  // Set scrolling to false after scroll stops
  scrollTimer = setTimeout(() => {
    isScrolling.value = false
  }, 150)

  if (!vListRef.value)
    return

  const threshold = 50
  const scrollSize = vListRef.value.scrollSize
  const viewportSize = vListRef.value.viewportSize
  const maxScroll = scrollSize - viewportSize

  const wasAtBottom = isAtBottom.value
  const wasAtTop = isAtTop.value

  isAtBottom.value = offset >= maxScroll - threshold
  const isAtTopValue = offset <= threshold
  isAtTop.value = isAtTopValue

  // Trigger callbacks only when transitioning to top/bottom (not continuously)
  if (isAtTopValue && !wasAtTop && props.onScrollToTop) {
    props.onScrollToTop()
  }

  if (isAtBottom.value && !wasAtBottom && props.onScrollToBottom) {
    props.onScrollToBottom()
  }

  emit('scroll', {
    scrollTop: offset,
    isAtTop: isAtTopValue,
    isAtBottom: isAtBottom.value,
  })
}

// Scroll to bottom method (exposed to parent)
async function scrollToBottom() {
  await nextTick()
  if (vListRef.value) {
    vListRef.value.scrollToIndex(renderItems.value.length - 1, { align: 'end' })
    isAtBottom.value = true
  }
}

async function scrollToMessage(messageId: string | number) {
  const targetIndex = renderItems.value.findIndex(item => item.type === 'message' && item.message.uuid === messageId)
  if (targetIndex === -1 || !vListRef.value)
    return

  await nextTick()
  vListRef.value.scrollToIndex(targetIndex, { align: 'center' })
}

// Get scroll offset for maintaining position
function getScrollOffset(anchorId: string | number): { anchorIndex: number, offset: number } | null {
  const anchorIndex = renderItems.value.findIndex(item => item.type === 'message' && item.message.uuid === anchorId)
  if (anchorIndex === -1)
    return null

  return {
    anchorIndex,
    offset: scrollTop.value,
  }
}

// Restore scroll position using anchor
async function restoreScrollPosition(anchor: { anchorIndex: number, offset: number }) {
  await nextTick()
  if (!vListRef.value)
    return

  vListRef.value.scrollToIndex(anchor.anchorIndex)
}

defineExpose({
  scrollToBottom,
  scrollToTop: () => {
    if (vListRef.value) {
      vListRef.value.scrollToIndex(0)
    }
  },
  getScrollOffset,
  restoreScrollPosition,
  scrollToMessage,
})
</script>

<template>
  <div class="relative h-full overflow-hidden">
    <VList
      ref="vListRef"
      :data="renderItems"
      class="h-full pb-32"
      :item-size="72"
      shift
      @scroll="onScroll"
      @scroll-end="() => (isScrolling = false)"
    >
      <template #default="{ item }">
        <div v-if="item.type === 'separator'" :key="item.id" class="w-full py-3">
          <div class="flex justify-center">
            <div class="rounded-full bg-card/80 px-3 py-1 text-xs text-muted-foreground font-medium shadow-sm backdrop-blur-sm">
              {{ item.label }}
            </div>
          </div>
        </div>

        <div v-else :key="item.id" class="w-full">
          <MessageBubble
            :message="item.message"
            :previous-message="getPreviousMessage(item.messageIndex)"
            :next-message="getNextMessage(item.messageIndex)"
          />
        </div>
      </template>
    </VList>

    <!-- Loading indicators -->
    <div
      v-if="isScrolling"
      class="absolute right-2 top-4 z-20 flex items-center gap-1.5 border rounded-full bg-card/90 px-3 py-1.5 text-xs text-muted-foreground font-medium leading-none shadow-lg backdrop-blur-sm -translate-x-1/2"
    >
      <span class="i-lucide-loader-2 inline-block h-3 w-3 animate-spin" />
      {{ t('virtualMessageList.scrolling') }}
    </div>

    <!-- Scroll to bottom button -->
    <Transition
      enter-active-class="transition-all duration-200"
      enter-from-class="opacity-0 scale-90 translate-y-2"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition-all duration-150"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-90 translate-y-2"
    >
      <button
        v-if="!isAtBottom && !isScrolling"
        class="absolute bottom-6 right-6 h-12 w-12 flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl transition-all hover:scale-110 hover:shadow-2xl"
        @click="scrollToBottom"
      >
        <i class="i-lucide-chevron-down h-5 w-5" />
      </button>
    </Transition>
  </div>
</template>
