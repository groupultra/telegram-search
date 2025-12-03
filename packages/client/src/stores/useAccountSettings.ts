import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAccountStore = defineStore('account', () => {
  const accountSettings = ref()

  return { accountSettings }
})
