import { usePreferredDark, useToggle } from '@vueuse/core'
import { defineStore } from 'pinia'

export const useSettingsStore = defineStore('settings', () => {
  const isDark = usePreferredDark()
  const toggleDark = useToggle(isDark)

  return { isDark, toggleDark }
})
