import type { Config } from '@tg-search/common'

import { generateDefaultConfig } from '@tg-search/common'
import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  const theme = useLocalStorage<string>('settings/theme', 'default')
  const storageConfig = useLocalStorage<Config>('settings/config', generateDefaultConfig())

  const themesOptions = ref<{ name: string, value: string }[]>([
    { name: '默认', value: 'default' },
    { name: '莫奈', value: 'monet' },
    { name: '橙色', value: 'orange' },
    { name: '绿色', value: 'green' },
    { name: '淡蓝', value: 'light-blue' },
  ])

  return {
    theme,
    themesOptions,
    config: storageConfig,
  }
})
