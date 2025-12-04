import { useLogger } from '@guiiai/logg'
import { generateDefaultAccountSettings } from '@tg-search/core'
import { defineStore, storeToRefs } from 'pinia'
import { ref, watch } from 'vue'

import { useBridgeStore } from '../composables/useBridge'

export const useAccountStore = defineStore('account', () => {
  const accountSettings = ref(generateDefaultAccountSettings())
  const { activeSessionId } = storeToRefs(useBridgeStore())

  const isReady = ref(false)

  function markReady() {
    isReady.value = true
  }

  function resetReady() {
    isReady.value = false
  }

  function init() {
    if (isReady.value) {
      useBridgeStore().sendEvent('config:fetch')
    }
  }

  watch(activeSessionId, () => {
    if (isReady.value) {
      useLogger('AccountStore').log('Fetching config for new session')
      useBridgeStore().sendEvent('config:fetch')
    }
  })

  return {
    init,
    markReady,
    resetReady,
    accountSettings,
  }
})
