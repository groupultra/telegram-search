<script lang="ts" setup>
import buildTime from '~build/time'

import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { abbreviatedSha as gitShortSha } from '~build/git'
import { version as pkgVersion } from '~build/package'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'

import AppRail from '../components/layout/AppRail.vue'
import ChatPanel from '../components/layout/ChatPanel.vue'
import MobileNav from '../components/layout/MobileNav.vue'
import SearchDialog from '../components/SearchDialog.vue'
import AIChatPage from '../pages/ai-chat.vue'

import { Dialog, DialogContent } from '../components/ui/Dialog'
import { useChatPanel } from '../composables/use-chat-panel'
import { useGlobalSearchDialog } from '../composables/use-global-search-dialog'

const route = useRoute()
const isAIChatDrawerOpen = ref(false)
const aiChatDrawerChatIds = ref<number[]>([])

// --- Build info using unplugin-info ---
const buildVersionLabel = computed(() => {
  const version = pkgVersion ?? 'dev'
  const commit = gitShortSha
  return commit ? `${version} (${commit})` : version
})

const buildTimeLabel = computed(() => {
  const date = new Date(buildTime)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
})
// --------------------------------------

// Use VueUse breakpoints for responsive design
const breakpoints = useBreakpoints(breakpointsTailwind)
const isMobile = breakpoints.smaller('md') // < 768px

const { isOpen: isChatPanelOpen, sidebarWidthRem } = useChatPanel()

// Fixed overlays teleported to <body> (e.g. the AI context bar) read this to
// center themselves over the content area instead of the whole viewport.
watch([isMobile, sidebarWidthRem], ([mobile, width]) => {
  document.documentElement.style.setProperty('--app-sidebar-width', mobile ? '0rem' : `${width}rem`)
}, { immediate: true })

const OPEN_GLOBAL_SEARCH_EVENT = 'tg-search:open-global-search'
const OPEN_AI_CHAT_EVENT = 'tg-search:open-ai-chat'
const AI_CHAT_DRAWER_STATE_EVENT = 'tg-search:ai-chat-drawer-state'

const currentRouteChatId = computed(() => {
  if (!route.path.startsWith('/chat/')) {
    return undefined
  }

  return typeof route.params.id === 'string' ? route.params.id : undefined
})

const {
  isOpen: isGlobalSearchOpen,
  open: openGlobalSearch,
  searchChatId,
} = useGlobalSearchDialog(currentRouteChatId)

function onOpenGlobalSearch() {
  openGlobalSearch()
}

function onOpenAIChat(event: Event) {
  const customEvent = event as CustomEvent<{ chatIds?: number[] }>
  aiChatDrawerChatIds.value = (customEvent.detail?.chatIds ?? []).filter(id => Number.isFinite(id))
  isAIChatDrawerOpen.value = true
}

function onGlobalSearchShortcut(event: KeyboardEvent) {
  const isCmdOrCtrl = event.metaKey || event.ctrlKey
  if (!isCmdOrCtrl || event.key.toLowerCase() !== 'k') {
    return
  }

  event.preventDefault()
  openGlobalSearch()
}

onMounted(() => {
  window.addEventListener(OPEN_GLOBAL_SEARCH_EVENT, onOpenGlobalSearch)
  window.addEventListener(OPEN_AI_CHAT_EVENT, onOpenAIChat)
  window.addEventListener('keydown', onGlobalSearchShortcut)
})

onBeforeUnmount(() => {
  window.removeEventListener(OPEN_GLOBAL_SEARCH_EVENT, onOpenGlobalSearch)
  window.removeEventListener(OPEN_AI_CHAT_EVENT, onOpenAIChat)
  window.removeEventListener('keydown', onGlobalSearchShortcut)
})

watch(isAIChatDrawerOpen, (open) => {
  window.dispatchEvent(new CustomEvent(AI_CHAT_DRAWER_STATE_EVENT, {
    detail: { open },
  }))
})
</script>

<template>
  <div class="w-full flex overflow-hidden bg-background text-sm h-dvh">
    <!-- Login Overlay -->
    <div
      v-if="$route.path === '/login'"
      class="fixed inset-0 z-50 flex items-center justify-center bg-background"
    >
      <RouterView />
    </div>

    <!-- Main Application Structure -->
    <template v-else>
      <!-- Mobile Nav -->
      <MobileNav v-if="isMobile" />

      <!-- Desktop: navigation rail + chat list panel -->
      <template v-if="!isMobile">
        <AppRail @open-search="openGlobalSearch" />
        <!-- v-show keeps the list scroll position and AI context selection while hidden -->
        <ChatPanel v-show="isChatPanelOpen" class="w-80 shrink-0 border-r" />
      </template>

      <!-- Main content -->
      <main
        class="relative min-w-0 flex flex-1 flex-col overflow-auto bg-background"
        :class="{ 'pb-[calc(3.5rem+env(safe-area-inset-bottom))]': isMobile && !$route.path.startsWith('/chat/') }"
      >
        <RouterView :key="$route.fullPath" />

        <!-- Version info -->
        <div
          v-if="!$route.path.startsWith('/chat/')"
          class="pointer-events-none fixed bottom-3 right-3 z-10 items-center gap-2 text-[10px] text-muted-foreground/60 font-mono hidden md:flex"
        >
          <span class="truncate">{{ buildVersionLabel }}</span>
          <span
            v-if="buildTimeLabel"
            class="truncate"
          >{{ buildTimeLabel }}</span>
        </div>
      </main>
    </template>
  </div>

  <SearchDialog v-model:open="isGlobalSearchOpen" :chat-id="searchChatId" />

  <Dialog v-model:open="isAIChatDrawerOpen">
    <DialogContent
      class="left-auto right-0 top-0 max-w-[min(720px,100vw)] w-full translate-x-0 translate-y-0 border-0 border-l rounded-none p-0 shadow-2xl h-dvh sm:rounded-none"
      :show-close-button="true"
    >
      <AIChatPage :chat-ids="aiChatDrawerChatIds" />
    </DialogContent>
  </Dialog>
</template>
