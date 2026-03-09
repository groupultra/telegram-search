<script lang="ts" setup>
import buildTime from '~build/time'

import { useAccountStore } from '@tg-search/client'
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { abbreviatedSha as gitShortSha } from '~build/git'
import { version as pkgVersion } from '~build/package'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { RouterView } from 'vue-router'

import AppSidebar from '../components/layout/AppSidebar.vue'
import MobileNav from '../components/layout/MobileNav.vue'

const { isReady } = storeToRefs(useAccountStore())

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
</script>

<template>
  <div
    class="h-screen w-full flex overflow-hidden bg-background text-sm font-medium"
  >
    <!-- Login Overlay -->
    <div
      v-if="!isReady && $route.path === '/login'"
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
</template>
