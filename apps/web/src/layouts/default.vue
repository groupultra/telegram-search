<script lang="ts" setup>
import buildTime from '~build/time'

import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { abbreviatedSha as gitShortSha } from '~build/git'
import { version as pkgVersion } from '~build/package'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'

import AppSidebar from '../components/layout/AppSidebar.vue'
import MobileNav from '../components/layout/MobileNav.vue'
import SearchDialog from '../components/SearchDialog.vue'
import AIChatPage from '../pages/ai-chat.vue'

import { Dialog, DialogContent } from '../components/ui/Dialog'

const route = useRoute()
const isGlobalSearchOpen = ref(false)
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

// Computed classes for responsive design
const sidebarClasses = computed(() => {
  return {
    container: isMobile.value ? 'hidden' : 'w-80',
  }
})

const OPEN_GLOBAL_SEARCH_EVENT = 'tg-search:open-global-search'
const OPEN_AI_CHAT_EVENT = 'tg-search:open-ai-chat'
const AI_CHAT_DRAWER_STATE_EVENT = 'tg-search:ai-chat-drawer-state'

const currentRouteChatId = computed(() => {
  if (!route.path.startsWith('/chat/')) {
    return undefined
  }

  return typeof route.params.id === 'string' ? route.params.id : undefined
})

function openGlobalSearch() {
  isGlobalSearchOpen.value = true
}

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
  <div
    class="h-screen w-full flex overflow-hidden bg-background text-sm font-medium"
  >
    <!-- Login Overlay -->
    <div
      v-if="$route.path === '/login'"
      class="fixed inset-0 z-50 flex items-center justify-center bg-background/20 backdrop-blur-[2px]"
    >
      <RouterView />
    </div>

    <!-- Main Application Structure (Always Rendered) -->
    <div class="h-full w-full flex overflow-hidden">
      <!-- Mobile Nav -->
      <MobileNav v-if="isMobile && $route.path !== '/login' && !$route.path.startsWith('/chat/')" />

      <!-- Sidebar -->
      <div
        v-if="!isMobile"
        :class="sidebarClasses.container"
        class="flex flex-col border-r bg-card h-dvh"
      >
        <AppSidebar />
      </div>

      <!-- Main content -->
      <div
        class="relative flex flex-1 flex-col overflow-auto bg-background"
        :class="{ 'ml-0': isMobile, 'pb-24': isMobile && !$route.path.startsWith('/chat/') && $route.path !== '/chats' }"
      >
        <!-- Only render main content router-view if NOT login page to avoid duplicate views -->
        <RouterView v-if="$route.path !== '/login'" :key="$route.fullPath" />

        <!-- Placeholder for main content when login overlay is active -->
        <div v-else class="pointer-events-none flex flex-1 flex-col gap-4 overflow-hidden p-4 opacity-100 blur-[2px] filter md:p-6">
          <div class="h-14 w-full rounded-xl bg-muted/60" />
          <div class="grid grid-cols-1 flex-1 gap-4 md:grid-cols-3">
            <div class="rounded-xl bg-muted/50 md:col-span-1" />
            <div class="rounded-xl bg-muted/40 md:col-span-2" />
          </div>
        </div>

        <!-- Version info -->
        <div
          v-if="!$route.path.startsWith('/chat/')"
          class="pointer-events-none fixed bottom-3 right-3 z-10 flex items-center gap-2 text-xs text-muted-foreground opacity-50"
        >
          <span class="truncate">{{ buildVersionLabel }}</span>
          <span
            v-if="buildTimeLabel"
            class="truncate"
          >{{ buildTimeLabel }}</span>
        </div>
      </div>
    </div>
  </div>

  <SearchDialog v-model:open="isGlobalSearchOpen" :chat-id="currentRouteChatId" />

  <Dialog v-model:open="isAIChatDrawerOpen">
    <DialogContent
      class="left-auto right-0 top-0 h-screen max-w-[min(760px,100vw)] w-full translate-x-0 translate-y-0 border-0 border-l rounded-none p-0"
      :show-close-button="true"
    >
      <AIChatPage :chat-ids="aiChatDrawerChatIds" />
    </DialogContent>
  </Dialog>
</template>
