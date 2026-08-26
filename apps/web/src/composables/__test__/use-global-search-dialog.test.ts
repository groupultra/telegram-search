import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import { useGlobalSearchDialog } from '../use-global-search-dialog'

describe('useGlobalSearchDialog', () => {
  it('keeps the opening chat stable while a result changes the route', () => {
    const currentRouteChatId = ref<string | undefined>('100')
    const dialog = useGlobalSearchDialog(currentRouteChatId)

    dialog.open()
    currentRouteChatId.value = '200'

    expect(dialog.isOpen.value).toBe(true)
    expect(dialog.searchChatId.value).toBe('100')
  })

  it('uses the current chat when search is opened again', () => {
    const currentRouteChatId = ref<string | undefined>('100')
    const dialog = useGlobalSearchDialog(currentRouteChatId)

    dialog.open()
    dialog.isOpen.value = false
    currentRouteChatId.value = '200'
    dialog.open()

    expect(dialog.searchChatId.value).toBe('200')
  })
})
