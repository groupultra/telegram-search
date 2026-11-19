import { createSharedComposable, useLocalStorage } from '@vueuse/core'
import { computed } from 'vue'

// Widths of the desktop navigation rail and the chat list panel, in rem.
// Kept here so fixed overlays (AI context bar) can center over the content area.
const RAIL_WIDTH_REM = 3.5
const CHAT_PANEL_WIDTH_REM = 20

/**
 * Open/closed state of the desktop chat list panel, persisted per browser.
 */
export const useChatPanel = createSharedComposable(() => {
  const isOpen = useLocalStorage('tg-search/chat-panel-open', true)

  const sidebarWidthRem = computed(() => RAIL_WIDTH_REM + (isOpen.value ? CHAT_PANEL_WIDTH_REM : 0))

  function toggle() {
    isOpen.value = !isOpen.value
  }

  return { isOpen, sidebarWidthRem, toggle }
})
