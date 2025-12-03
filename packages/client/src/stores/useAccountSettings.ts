import { useLogger } from '@guiiai/logg'
import { generateDefaultAccountSettings } from '@tg-search/core'
import { defineStore, storeToRefs } from 'pinia'
import { ref, watch } from 'vue'

import { useBridgeStore } from '../composables/useBridge'

export const useAccountStore = defineStore('account', () => {
  const accountSettings = ref(generateDefaultAccountSettings())
  const { activeSessionId } = storeToRefs(useBridgeStore())

  function init() {
    useBridgeStore().sendEvent('config:fetch')
  }

  watch(activeSessionId, (newId) => {
    if (newId) {
      useLogger('AccountStore').log('Fetching config for new session')
      useBridgeStore().sendEvent('config:fetch')
    }
  })

  return {
    init,
    accountSettings,
  }
})
