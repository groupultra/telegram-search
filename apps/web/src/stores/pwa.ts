// https://github.com/moeru-ai/airi/blob/76233f883a25fc7875438b6ff34811839219e489/apps/stage-web/src/stores/pwa.ts

import { useLogger } from '@guiiai/logg'
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { nanoid } from 'nanoid'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { h, markRaw, ref } from 'vue'
import { toast } from 'vue-sonner'

import ToasterPWAUpdateReady from '../components/ToasterPWAUpdateReady.vue'

export const usePWAStore = defineStore('pwa', () => {
  const updateReadyHooks = ref<(() => void)[]>([])
  const breakpoints = useBreakpoints(breakpointsTailwind)
  const isMobile = breakpoints.smaller('md')
  const isInitialized = ref(false)

  async function unregisterExistingServiceWorkers() {
    if (!('serviceWorker' in navigator)) {
      return
    }

    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map(async (registration) => {
      try {
        await registration.unregister()
      }
      catch (error) {
        useLogger('PWA').withError(error).warn('Failed to unregister service worker')
      }
    }))
  }

  async function init() {
    if (import.meta.env.SSR) {
      return
    }

    if (isInitialized.value) {
      useLogger('PWA').debug('Already initialized, skipping')
      return
    }

    // NOTICE: local dev regularly switches between preview/dev servers and
    // stale service workers can trap the app in an old boot state.
    if (import.meta.env.DEV) {
      await unregisterExistingServiceWorkers()
      isInitialized.value = true
      return
    }

    const { registerSW } = await import('../modules/pwa')

    const updateSW = registerSW({
      onNeedRefresh: () => {
        const id = nanoid()
        toast(markRaw(h(ToasterPWAUpdateReady, { id, onUpdate: () => updateSW() })), {
          id,
          duration: 30000,
          position: isMobile.value ? 'top-center' : 'bottom-right',
        })
      },
    })

    updateReadyHooks.value.push(updateSW)
    isInitialized.value = true
  }

  return {
    init,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(usePWAStore, import.meta.hot))
}
