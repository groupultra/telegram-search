import { generateDefaultAccountSettings } from '@tg-search/core'
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { useBridgeStore } from '../composables/useBridge'

export const useAccountStore = defineStore('account', () => {
  const accountSettings = ref(generateDefaultAccountSettings())

  function init() {
    useBridgeStore().sendEvent('config:fetch')
  }

  return {
    init,
    accountSettings,
  }
})
