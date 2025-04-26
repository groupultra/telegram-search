import { coreConfigSchema } from '@tg-search/common'
import { useLocalStorage, usePreferredDark, useToggle } from '@vueuse/core'
import { defineStore } from 'pinia'

export const useSettingsStore = defineStore('settings', () => {
  const isDark = usePreferredDark()
  const toggleDark = useToggle(isDark)

  const config = useLocalStorage('config', coreConfigSchema.parse({}))

  return {
    isDark,
    toggleDark,
    config,
  }
})
