<script setup lang="ts">
import { useLogger } from '@guiiai/logg'
import { evictExpiredOrOversized, useAccountStore, useAvatarStore, useBridge, useSessionStore } from '@tg-search/client'
import { hideSplashScreen } from 'vite-plugin-splash-screen/runtime'
import { onBeforeUnmount, onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { Toaster } from 'vue-sonner'

import { usePWAStore } from './stores/pwa'

onMounted(() => {
  usePWAStore().init()

  hideSplashScreen()

  useSessionStore().init()
  useBridge().init().then(() => {
    useAccountStore().init()
  })
})

const avatarStore = useAvatarStore()
let avatarCleanupTimer: number | undefined

/**
 * Setup periodic avatar cache cleanup to revoke expired blob URLs.
 * - Runs every 15 minutes to keep memory footprint small.
 * - Clears timer on unmount to avoid dangling intervals.
 */
function setupAvatarCleanupScheduler() {
  // Initial cleanup on app start
  avatarStore.cleanupExpired()
  // Also evict expired or oversized records from IndexedDB (50MB budget)
  evictExpiredOrOversized().catch((error) => {
    // Warn-only logging to comply with lint rules
    useLogger('avatars').withError(error).warn('Failed to evict records on init')
  })
  // 15 minutes interval
  avatarCleanupTimer = window.setInterval(() => {
    avatarStore.cleanupExpired()
    evictExpiredOrOversized().catch((error) => {
      // Warn-only logging to comply with lint rules
      useLogger('avatars').withError(error).warn('Failed to evict records in interval')
    })
  }, 15 * 60 * 1000)
}

onMounted(() => {
  setupAvatarCleanupScheduler()
})

onBeforeUnmount(() => {
  if (avatarCleanupTimer)
    window.clearInterval(avatarCleanupTimer)
})
</script>

<template>
  <div class="min-h-screen bg-white transition-all duration-300 ease-in-out dark:bg-gray-900">
    <Toaster position="top-right" :expand="true" :rich-colors="true" />

    <RouterView v-slot="{ Component }">
      <Transition>
        <KeepAlive>
          <component :is="Component" />
        </KeepAlive>
      </Transition>
    </RouterView>
  </div>
</template>
