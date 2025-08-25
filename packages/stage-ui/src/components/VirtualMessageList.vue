<script setup lang="ts">
// TODO: use vue-virtual-scroller instead

import type { CoreMessage } from '@tg-search/core'

import type { VirtualListItem } from '../composables/useVirtualList'

import { useResizeObserver, useWindowSize } from '@vueuse/core'
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useVirtualList } from '../composables/useVirtualList'
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

const { height: windowHeight } = useWindowSize()
const virtualListContainer = ref<HTMLElement>()
const containerHeight = ref(0)

// Convert messages to virtual list items
const virtualItems = ref<VirtualListItem[]>([])

watch(() => props.messages, (newMessages) => {
  virtualItems.value = newMessages.map(msg => ({
    id: msg.uuid,
    data: msg,
    // Estimate height based on message content
    height: estimateMessageHeight(msg),
  }))
}, { immediate: true })

// Estimate message height based on content with better calculations
function estimateMessageHeight(message: any): number {
  const baseHeight = 60 // Base height for avatar + padding
  const lineHeight = 24 // Increased for better text spacing
  const maxLineWidth = 60 // Approximate characters per line accounting for container width

  if (!message.content)
    return baseHeight

  // More accurate text length estimation
  const textContent = typeof message.content === 'string' ? message.content : String(message.content)
  const textLength = textContent.length
  const estimatedLines = Math.max(1, Math.ceil(textLength / maxLineWidth))

  // Add extra height for media, files, etc. with more realistic values
  // FIXME: dynamic media height calculation
  let extraHeight = 0
  if (message.media?.type === 'photo')
    extraHeight += 250 // Increased for image display
  if (message.media?.type === 'video')
    extraHeight += 250 // Increased for video player
  if (message.media?.type === 'document')
    extraHeight += 50 // Slightly increased for document display
  if (message.replyTo)
    extraHeight += 40 // Increased for reply preview
  if (message.forwarded)
    extraHeight += 20 // Add height for forward indicator
  if (message.reactions && message.reactions.length > 0)
    extraHeight += 30 // Add height for reactions

  // Add minimum height for very short messages
  const calculatedHeight = baseHeight + (estimatedLines * lineHeight) + extraHeight
  return Math.max(calculatedHeight, 80) // Minimum message height
}

const {
  containerRef,
  state,
  totalHeight,
  visibleItems,
  // visibleRange is available but not currently used
  handleScroll,
  measureItem,
  scrollToBottom,
  getScrollOffset,
  restoreScrollPosition,
  updateContainerHeight,
} = useVirtualList(virtualItems, {
  itemHeight: 80, // Default height
  containerHeight: containerHeight.value,
  overscan: 5,
})

// Update container height when window resizes or container size changes
useResizeObserver(virtualListContainer, (entries) => {
  const entry = entries[0]
  if (entry && entry.contentRect.height > 0) {
    containerHeight.value = entry.contentRect.height
    // Update virtual list with new container height
    updateContainerHeight(containerHeight.value)
  }
})

// Handle ResizeObserver for individual message items
const messageObserver = ref<ResizeObserver>()

onMounted(() => {
  // Set initial container height with fallback
  nextTick(() => {
    if (virtualListContainer.value) {
      const height = virtualListContainer.value.clientHeight
      containerHeight.value = height > 0 ? height : Math.max(windowHeight.value - 200, 400)
    }
    else {
      containerHeight.value = Math.max(windowHeight.value - 200, 400)
    }
    // Update virtual list with initial height
    updateContainerHeight(containerHeight.value)
  })

  // Create ResizeObserver for measuring actual message heights
  messageObserver.value = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const element = entry.target as HTMLElement
      const messageId = element.dataset.messageId
      if (messageId) {
        measureItem(messageId, entry.contentRect.height)
      }
    }
  })
})

onUnmounted(() => {
  messageObserver.value?.disconnect()
})

// Auto scroll to bottom when new messages arrive
const isAtBottom = ref(true)
let lastMessageCount = 0

watch(virtualItems, async (newItems) => {
  const newMessageCount = newItems.length
  const hasNewMessages = newMessageCount > lastMessageCount

  if (hasNewMessages && props.autoScrollToBottom && isAtBottom.value) {
    await nextTick()
    scrollToBottom()
  }

  lastMessageCount = newMessageCount
}, { flush: 'post' })

// Handle scroll events and emit status
function onScroll(event: Event) {
  handleScroll(event)

  const threshold = 50
  const scrollTop = state.scrollTop
  const maxScroll = totalHeight.value - containerHeight.value

  isAtBottom.value = scrollTop >= maxScroll - threshold
  const isAtTopValue = scrollTop <= threshold

  // Trigger callbacks
  if (isAtTopValue && props.onScrollToTop) {
    props.onScrollToTop()
  }

  if (isAtBottom.value && props.onScrollToBottom) {
    props.onScrollToBottom()
  }

  emit('scroll', {
    scrollTop,
    isAtTop: isAtTopValue,
    isAtBottom: isAtBottom.value,
  })
}

// Observe message elements for height measurement
function observeMessage(element: HTMLElement, messageId: string | number) {
  if (messageObserver.value && element) {
    element.dataset.messageId = String(messageId)
    messageObserver.value.observe(element)
  }
}

// Scroll to bottom method (exposed to parent)
async function scrollToLatest() {
  await scrollToBottom()
  isAtBottom.value = true
}

defineExpose({
  scrollToBottom: scrollToLatest,
  scrollToTop: () => {
    if (containerRef.value) {
      containerRef.value.scrollTop = 0
    }
  },
  getScrollOffset,
  restoreScrollPosition,
})
</script>

<template>
  <div
    ref="virtualListContainer"
    class="relative h-full overflow-hidden"
  >
    <div
      ref="containerRef"
      class="h-full overflow-y-auto"
      @scroll="onScroll"
    >
      <!-- Virtual list container with dynamic height -->
      <div
        class="relative w-full"
        :style="{ height: `${totalHeight}px` }"
      >
        <!-- Rendered visible items -->
        <div
          v-for="{ item, style } in visibleItems"
          :key="item.id"
          :style="style"
          class="w-full"
        >
          <!-- Message wrapper with resize observation -->
          <div
            :ref="(el) => el && observeMessage(el as HTMLElement, item.id)"
            class="w-full"
          >
            <MessageBubble :message="item.data" />
          </div>
        </div>
      </div>
    </div>

    <!-- Loading indicators -->
    <div
      v-if="state.isScrolling"
      class="absolute right-2 top-2 rounded bg-black/20 px-2 py-1 text-xs text-white"
    >
      {{ t('virtualMessageList.scrolling') }}
    </div>

    <!-- Scroll to bottom button -->
    <Transition
      enter-active-class="transition-all duration-200"
      enter-from-class="opacity-0 scale-90"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition-all duration-150"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-90"
    >
      <button
        v-if="!isAtBottom && !state.isScrolling"
        class="absolute bottom-4 right-4 h-10 w-10 flex items-center justify-center rounded-full bg-blue-500 text-white shadow-lg transition-colors hover:bg-blue-600"
        @click="scrollToLatest"
      >
        <i class="i-lucide-chevron-down" />
      </button>
    </Transition>
  </div>
</template>
