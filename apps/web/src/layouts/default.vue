<script lang="ts" setup>
import buildTime from '~build/time'

import { useAccountStore } from '@tg-search/client'
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { abbreviatedSha as gitShortSha } from '~build/git'
import { version as pkgVersion } from '~build/package'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'

import AppSidebar from '../components/layout/AppSidebar.vue'
import LoginPromptBanner from '../components/layout/LoginPromptBanner.vue'

import { Button } from '../components/ui/Button'

const { isReady } = storeToRefs(useAccountStore())

const route = useRoute()

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

// Mobile drawer state
const mobileDrawerOpen = ref(false)

// Computed classes for responsive design
const sidebarClasses = computed(() => {
  if (isMobile.value) {
    return {
      container: `fixed inset-y-0 left-0 z-40 w-80 transform transition-transform duration-300 ease-in-out ${
        mobileDrawerOpen.value ? 'translate-x-0' : '-translate-x-full'
      }`,
      backdrop: mobileDrawerOpen.value,
    }
  }
  else {
    return {
      container: 'w-80',
      backdrop: false,
    }
  }
})

// Close mobile drawer when route changes
watch(route, () => {
  if (isMobile.value) {
    mobileDrawerOpen.value = false
  }
})

function toggleSidebar() {
  if (isMobile.value) {
    mobileDrawerOpen.value = !mobileDrawerOpen.value
  }
}

function closeMobileDrawer() {
  if (isMobile.value) {
    mobileDrawerOpen.value = false
  }
}
</script>

<template>
  <div
    class="h-screen w-full flex overflow-hidden bg-background text-sm font-medium"
  >
    <!-- Mobile backdrop -->
    <div
      v-if="sidebarClasses.backdrop"
      class="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px] transition-opacity"
      @click="closeMobileDrawer"
    />

    <!-- Mobile menu button -->
    <div
      v-if="isMobile"
      class="fixed left-4 top-4 z-50"
    >
      <Button
        icon="i-lucide-menu"
        size="md"
        variant="outline"
        class="h-10 w-10 rounded-lg shadow-md backdrop-blur-sm"
        @click="toggleSidebar"
      />
    </div>

    <!-- Sidebar -->
    <div
      :class="sidebarClasses.container"
      class="flex flex-col border-r bg-card h-dvh"
    >
      <AppSidebar />
    </div>

    <!-- Main content -->
    <div
      class="relative flex flex-1 flex-col overflow-auto bg-background"
      :class="{ 'ml-0': isMobile }"
    >
      <!-- Login prompt banner -->
      <LoginPromptBanner v-if="!isReady && !$route.path.startsWith('/login')" />

      <template v-else>
        <RouterView :key="$route.fullPath" />
      </template>

      <!-- Version info -->
      <div class="pointer-events-none fixed bottom-3 right-3 z-10 flex items-center gap-2 text-xs text-muted-foreground opacity-50">
        <span class="truncate">{{ buildVersionLabel }}</span>
        <span
          v-if="buildTimeLabel"
          class="truncate"
        >{{ buildTimeLabel }}</span>
      </div>
    </div>
  </div>
</template>
