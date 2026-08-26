import type { Ref } from 'vue'

import { ref } from 'vue'

/**
 * Keeps the layout-owned search dialog tied to the chat where it was opened.
 * A selected result can change the route, but must not replace the dialog's
 * state (or destroy its result list) before the user reopens search.
 */
export function useGlobalSearchDialog(currentRouteChatId: Ref<string | undefined>) {
  const isOpen = ref(false)
  const searchChatId = ref<string>()

  function open() {
    searchChatId.value = currentRouteChatId.value
    isOpen.value = true
  }

  return {
    isOpen,
    open,
    searchChatId,
  }
}
