<script setup lang="ts">
import { useLogger } from '@guiiai/logg'
import { evictExpiredOrOversized, useAccountStore, useAvatarStore, useBridge, useSessionStore } from '@tg-search/client'
import { hideSplashScreen } from 'vite-plugin-splash-screen/runtime'
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterView, useRoute, useRouter } from 'vue-router'
import { toast, Toaster } from 'vue-sonner'

import { isServerAuthRoute, safeRedirectPath } from './lib/server-auth'
import { usePWAStore } from './stores/pwa'
import { useServerAuthStore } from './stores/server-auth'

const { t } = useI18n()

onMounted(() => {
  usePWAStore().init()

  hideSplashScreen()

  useSessionStore().init()
  useBridge().init().then(() => {
    useAccountStore().init()
  })
})

// With OAuth on the server, the Telegram login is the sign-in. Once the account is ready, an
// authorization flow continues on its own page; otherwise sign in to the server here.
const accountStore = useAccountStore()
const serverAuth = useServerAuthStore()
const router = useRouter()
const route = useRoute()
watch(() => accountStore.isReady, async (ready) => {
  if (!ready)
    return
  const redirect = safeRedirectPath(route.query.redirect, '')
  if (route.path === '/login' && isServerAuthRoute(redirect.split('?')[0])) {
    await router.replace(redirect)
    return
  }
  if (await serverAuth.check() !== 'signed-out')
    return
  try {
    await serverAuth.completeSignIn()
  }
  catch (error) {
    useLogger('server-auth').withError(error).warn('Failed to sign in to the server')
    toast.error(t('serverAuth.signIn.failed'))
  }
}, { immediate: true })

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
  <div class="min-h-screen bg-background text-foreground transition-all duration-300 ease-in-out">
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
