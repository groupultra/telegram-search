<script setup lang="ts">
import type { CoreMessage } from '@tg-search/core'

import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import MessageBubble from './messages/MessageBubble.vue'

type LoadStatus = 'fetched' | 'skipped' | void

interface Props {
  messages: CoreMessage[]
  onScrollToTop?: () => LoadStatus | Promise<LoadStatus>
  onScrollToBottom?: () => LoadStatus | Promise<LoadStatus>
  autoScrollToBottom?: boolean
  debug?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  autoScrollToBottom: true,
})

const emit = defineEmits<{
  scroll: [{ scrollTop: number, isAtTop: boolean, isAtBottom: boolean }]
}>()

const { t } = useI18n()

const scrollContainerRef = ref<HTMLDivElement>()
const topSentinelRef = ref<HTMLDivElement>()
const bottomSentinelRef = ref<HTMLDivElement>()

// Track scroll state
const isScrolling = ref(false)
let scrollTimer: ReturnType<typeof setTimeout> | null = null
let rafId: number | null = null
let topObserver: IntersectionObserver | null = null
let bottomObserver: IntersectionObserver | null = null
let pendingTopAnchorUuid: string | null = null
let pendingTopAnchorScrollTop: number | null = null
let topLoadArmed = true
let bottomLoadArmed = true
let topLoadPending = false
let topLoadCooldownUntil = 0
let topLoadRequiresLeave = false
let topLoadRequestId = 0

// Track if we're at top/bottom to prevent repeated callbacks
const isAtTop = ref(false)
const isAtBottom = ref(true)

const SCROLL_THRESHOLD = 50
const TOP_LOAD_COOLDOWN_MS = 240

function debugLog(label: string, data?: Record<string, unknown>) {
  if (!props.debug)
    return

  // eslint-disable-next-line no-console
  console.log(`[MessageList] ${label}`, data ?? '')
}

function finalizeTopLoad(requestId: number, reason: 'restore' | 'no-new-messages') {
  if (!topLoadPending || requestId !== topLoadRequestId)
    return

  topLoadPending = false
  topLoadCooldownUntil = Date.now() + TOP_LOAD_COOLDOWN_MS

  if (reason === 'no-new-messages') {
    pendingTopAnchorUuid = null
    pendingTopAnchorScrollTop = null
    debugLog('complete-top-load', { reason })
  }
}

function getFirstVisibleMessageUuid() {
  const el = scrollContainerRef.value
  if (!el)
    return null

  const messageEls = el.querySelectorAll<HTMLElement>('[data-message-uuid]')
  const containerRect = el.getBoundingClientRect()

  for (const msgEl of messageEls) {
    const rect = msgEl.getBoundingClientRect()
    const viewportBottom = rect.bottom - containerRect.top

    if (viewportBottom <= 0)
      continue

    return msgEl.getAttribute('data-message-uuid')
  }

  return null
}

// Separate auto-scroll watcher for appended messages (incoming at the bottom).
watch(() => props.messages, async (newMessages, oldMessages) => {
  const newCount = newMessages.length
  const oldCount = oldMessages?.length ?? 0

  if (newCount > oldCount && topLoadPending) {
    await nextTick()
    const el = scrollContainerRef.value
    const anchorUuid = pendingTopAnchorUuid
    const anchorScrollTop = pendingTopAnchorScrollTop
    const requestId = topLoadRequestId
    finalizeTopLoad(requestId, 'restore')
    pendingTopAnchorUuid = null
    pendingTopAnchorScrollTop = null

    if (el && anchorUuid) {
      if (el.scrollTop > SCROLL_THRESHOLD * 2) {
        debugLog('skip-restore-top-anchor', {
          anchorUuid: anchorUuid.slice(0, 8),
          reason: 'user-scrolled-away',
          currentScrollTop: el.scrollTop,
          anchorScrollTop,
        })
        return
      }

      const anchorEl = el.querySelector<HTMLElement>(`[data-message-uuid="${anchorUuid}"]`)
      anchorEl?.scrollIntoView({ block: 'start' })
      debugLog('restore-top-anchor', {
        anchorUuid: anchorUuid.slice(0, 8),
      })
    }
    return
  }

  if (newCount > oldCount && props.autoScrollToBottom && isAtBottom.value) {
    await nextTick()
    scrollToBottom()
  }
}, { flush: 'post' })

function handleScroll() {
  if (rafId !== null)
    return

  rafId = requestAnimationFrame(() => {
    rafId = null

    const el = scrollContainerRef.value
    if (!el)
      return

    const currentScrollTop = el.scrollTop
    const maxScroll = el.scrollHeight - el.clientHeight

    isScrolling.value = true
    if (scrollTimer)
      clearTimeout(scrollTimer)
    scrollTimer = setTimeout(() => {
      isScrolling.value = false
    }, 150)

    isAtBottom.value = currentScrollTop >= maxScroll - SCROLL_THRESHOLD
    const isAtTopValue = currentScrollTop <= SCROLL_THRESHOLD
    isAtTop.value = isAtTopValue

    const userMovedAwayFromAnchor = pendingTopAnchorScrollTop !== null
      && currentScrollTop > pendingTopAnchorScrollTop + SCROLL_THRESHOLD * 2

    if (userMovedAwayFromAnchor) {
      if (pendingTopAnchorUuid) {
        debugLog('cancel-pending-top-anchor', {
          anchorUuid: pendingTopAnchorUuid.slice(0, 8),
          currentScrollTop,
          anchorScrollTop: pendingTopAnchorScrollTop,
        })
        topLoadCooldownUntil = Date.now() + TOP_LOAD_COOLDOWN_MS
        topLoadRequiresLeave = true
      }
      topLoadPending = false
      pendingTopAnchorUuid = null
      pendingTopAnchorScrollTop = null
    }

    if (currentScrollTop > SCROLL_THRESHOLD * 4) {
      topLoadRequiresLeave = false
    }

    if (
      !topLoadPending
      && !topLoadRequiresLeave
      && currentScrollTop > SCROLL_THRESHOLD * 3
      && Date.now() >= topLoadCooldownUntil
    ) {
      topLoadArmed = true
    }

    if (maxScroll - currentScrollTop > SCROLL_THRESHOLD * 2) {
      bottomLoadArmed = true
    }

    emit('scroll', {
      scrollTop: currentScrollTop,
      isAtTop: isAtTopValue,
      isAtBottom: isAtBottom.value,
    })
  })
}

function setupBoundaryObservers() {
  const root = scrollContainerRef.value
  if (!root)
    return

  topObserver?.disconnect()
  bottomObserver?.disconnect()

  topObserver = new IntersectionObserver(
    ([entry]) => {
      if (!entry)
        return

      if (!entry.isIntersecting) {
        if (!topLoadPending && !topLoadRequiresLeave && Date.now() >= topLoadCooldownUntil) {
          topLoadArmed = true
        }
        return
      }

      if (
        !props.onScrollToTop
        || !topLoadArmed
        || topLoadPending
        || topLoadRequiresLeave
        || Date.now() < topLoadCooldownUntil
      ) {
        return
      }

      const maxScroll = root.scrollHeight - root.clientHeight
      if (maxScroll <= 0 || props.messages.length === 0)
        return

      topLoadArmed = false
      topLoadPending = true
      topLoadRequestId += 1
      const requestId = topLoadRequestId
      const anchorUuid = getFirstVisibleMessageUuid()
      debugLog('trigger-load-older', {
        scrollTop: root.scrollTop,
        maxScroll,
        reason: 'top-sentinel',
        anchorUuid: anchorUuid?.slice(0, 8),
      })
      pendingTopAnchorUuid = anchorUuid
      pendingTopAnchorScrollTop = root.scrollTop
      void Promise.resolve(props.onScrollToTop()).then(async (status) => {
        // If the caller skipped (e.g. already loading), reset the state
        // machine so it can re-arm on the next scroll movement.
        if (status === 'skipped') {
          topLoadPending = false
          topLoadArmed = true
          pendingTopAnchorUuid = null
          pendingTopAnchorScrollTop = null
          return
        }
        // Wait for the DOM update cycle so the message watch can fire
        // first if new messages arrived.
        await nextTick()
        await nextTick()
        // If topLoadPending is still true here, no new messages were
        // added (the watch didn't fire), so finalize explicitly.
        if (topLoadPending && requestId === topLoadRequestId) {
          finalizeTopLoad(requestId, 'no-new-messages')
        }
      }).catch(() => {
        // On error, reset so the user can retry
        finalizeTopLoad(requestId, 'no-new-messages')
      })
    },
    {
      root,
      rootMargin: '48px 0px 0px 0px',
      threshold: 0,
    },
  )

  bottomObserver = new IntersectionObserver(
    ([entry]) => {
      if (!entry)
        return

      if (!entry.isIntersecting) {
        bottomLoadArmed = true
        return
      }

      if (!props.onScrollToBottom || !bottomLoadArmed)
        return

      const maxScroll = root.scrollHeight - root.clientHeight
      if (maxScroll <= 0 || props.messages.length === 0)
        return

      bottomLoadArmed = false
      debugLog('trigger-load-newer', {
        scrollTop: root.scrollTop,
        maxScroll,
        reason: 'bottom-sentinel',
      })
      props.onScrollToBottom()
    },
    {
      root,
      rootMargin: '0px 0px 48px 0px',
      threshold: 0,
    },
  )

  if (topSentinelRef.value)
    topObserver.observe(topSentinelRef.value)

  if (bottomSentinelRef.value)
    bottomObserver.observe(bottomSentinelRef.value)
}

onMounted(() => {
  scrollContainerRef.value?.addEventListener('scroll', handleScroll, { passive: true })
  setupBoundaryObservers()
})

onUnmounted(() => {
  scrollContainerRef.value?.removeEventListener('scroll', handleScroll)
  topObserver?.disconnect()
  bottomObserver?.disconnect()
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
  }
  if (scrollTimer) {
    clearTimeout(scrollTimer)
  }
})

async function scrollToBottom() {
  await nextTick()
  const el = scrollContainerRef.value
  if (el) {
    el.scrollTop = el.scrollHeight
    isAtBottom.value = true
  }
}

async function scrollToMessage(messageId: string | number) {
  await nextTick()
  const el = scrollContainerRef.value
  if (!el)
    return

  const messageEl = el.querySelector(`[data-message-uuid="${messageId}"]`)
  if (messageEl) {
    messageEl.scrollIntoView({ block: 'center' })
  }
}

watch(
  () => props.messages.length,
  async () => {
    await nextTick()
    setupBoundaryObservers()
  },
)

defineExpose({
  scrollToBottom,
  scrollToTop: () => {
    const el = scrollContainerRef.value
    if (el) {
      el.scrollTop = 0
    }
  },
  scrollToMessage,
})
</script>

<template>
  <div class="relative h-full overflow-hidden">
    <div
      ref="scrollContainerRef"
      class="h-full overflow-y-auto pb-32"
      style="overflow-anchor: auto;"
    >
      <div ref="topSentinelRef" class="h-px w-full shrink-0" style="overflow-anchor: none;" />
      <div
        v-for="message in messages"
        :key="message.uuid"
        :data-message-uuid="message.uuid"
        class="w-full"
        style="overflow-anchor: auto;"
      >
        <MessageBubble :message="message" />
      </div>
      <div ref="bottomSentinelRef" class="h-px w-full shrink-0" style="overflow-anchor: none;" />
    </div>

    <!-- Scrolling indicator -->
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
