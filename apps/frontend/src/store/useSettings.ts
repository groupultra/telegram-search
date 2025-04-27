import type { CoreConfig } from '@tg-search/common'

import { generateDefaultConfig } from '@tg-search/common'
import { useLocalStorage, usePreferredDark, useToggle } from '@vueuse/core'
import { defineStore } from 'pinia'

export const useSettingsStore = defineStore('settings', () => {
  const isDark = usePreferredDark()
  const toggleDark = useToggle(isDark)

  const config = useLocalStorage<CoreConfig>('config', generateDefaultConfig())

  return {
    isDark,
    toggleDark,
    config,
  }
})
