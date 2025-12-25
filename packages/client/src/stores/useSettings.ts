import { useLocalStorage } from '@vueuse/core'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'

import { DEBUG_MODE } from '../../constants'

export type ChatGroup = 'folder' | undefined

export const useSettingsStore = defineStore('settings', () => {
  const debugMode = ref(DEBUG_MODE)
  const selectedGroup = useLocalStorage<ChatGroup>('settings/group-selected', undefined)
  const selectedFolderId = useLocalStorage<number | undefined>('settings/folder-selected', undefined)
  const language = useLocalStorage<string>('settings/language', 'en')

  return {
    selectedGroup,
    selectedFolderId,
    debugMode,
    language,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSettingsStore, import.meta.hot))
}
