<script setup lang="ts">
// https://github.com/moeru-ai/airi/blob/bd497051fe7090dc021888f127ae7b0d78095210/apps/stage-web/src/App.vue

import { evictExpiredOrOversized, useAvatarStore, useBootstrapStore, useSettingsStore } from '@tg-search/client'
import { storeToRefs } from 'pinia'
import { hideSplashScreen } from 'vite-plugin-splash-screen/runtime'
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { RouterView } from 'vue-router'
import { Toaster } from 'vue-sonner'

import { usePWAStore } from './stores/pwa'

const settings = storeToRefs(useSettingsStore())

onMounted(() => {
  useSettingsStore().init()
  usePWAStore().init()

  hideSplashScreen()

  useBootstrapStore().start()
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
    console.warn('[Avatar] Failed to evict records on init', error)
  })
  // 15 minutes interval
  avatarCleanupTimer = window.setInterval(() => {
    avatarStore.cleanupExpired()
    evictExpiredOrOversized().catch((error) => {
      // Warn-only logging to comply with lint rules
      console.warn('[Avatar] Failed to evict records in interval', error)
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

watch(settings.themeColorsHue, () => {
  document.documentElement.style.setProperty('--chromatic-hue', settings.themeColorsHue.value.toString())
}, { immediate: true })

watch(settings.themeColorsHueDynamic, () => {
  document.documentElement.classList.toggle('dynamic-hue', settings.themeColorsHueDynamic.value)
}, { immediate: true })
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
