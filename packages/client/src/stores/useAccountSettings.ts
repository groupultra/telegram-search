import { defineStore } from 'pinia'
import { ref } from 'vue'

import { useBridgeStore } from '../composables/useBridge'

export const useAccountStore = defineStore('account', () => {
  const accountSettings = ref()

  function init() {
    useBridgeStore().sendEvent('config:fetch')
  }

  return {
    init,
    accountSettings,
  }
})
