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

  async function init() {
    if (import.meta.env.SSR) {
      return
    }

    if (isInitialized.value) {
      useLogger('PWA').debug('Already initialized, skipping')
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
