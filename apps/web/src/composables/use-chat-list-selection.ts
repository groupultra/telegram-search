import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'

const AI_CONTEXT_HINT_STORAGE_KEY = 'tg-search:ai-context-hint-seen-v2'
const OPEN_AI_CHAT_EVENT = 'tg-search:open-ai-chat'
const AI_CHAT_DRAWER_STATE_EVENT = 'tg-search:ai-chat-drawer-state'
const LONG_PRESS_DURATION = 420

export function useChatListSelection(t: (key: string, params?: Record<string, unknown>) => string) {
  const isSelectionMode = ref(false)
  const aiContextChatIds = ref<number[]>([])
  const aiContextCount = computed(() => aiContextChatIds.value.length)
  const showAIContextHint = ref(false)
  const isAIChatDrawerOpen = ref(false)

  let longPressTimer: ReturnType<typeof setTimeout> | null = null
  const longPressTriggeredChatId = ref<number | null>(null)
  let hintDismissTimer: ReturnType<typeof setTimeout> | null = null

  function isChatInAIContext(chatId: number) {
    return aiContextChatIds.value.includes(chatId)
  }

  function addChatToAIContext(chatId: number) {
    if (isChatInAIContext(chatId)) {
      return
    }

    aiContextChatIds.value = [...aiContextChatIds.value, chatId]
  }

  function removeChatFromAIContext(chatId: number) {
    aiContextChatIds.value = aiContextChatIds.value.filter(id => id !== chatId)
    if (aiContextChatIds.value.length === 0) {
      isSelectionMode.value = false
    }
  }

  function toggleAIContextChat(chatId: number) {
    if (isChatInAIContext(chatId)) {
      removeChatFromAIContext(chatId)
      return
    }

    addChatToAIContext(chatId)
  }

  function enterSelectionMode(chatId: number) {
    const wasInactive = !isSelectionMode.value
    isSelectionMode.value = true
    addChatToAIContext(chatId)
    if (!wasInactive) {
      return
    }

    showAIContextHint.value = false
    localStorage.setItem(AI_CONTEXT_HINT_STORAGE_KEY, '1')
    toast.success(t('chatList.selectionModeEntered'))
  }

  function clearAIContextChats() {
    aiContextChatIds.value = []
    isSelectionMode.value = false
  }

  function openAIChatWithSelectedChats() {
    if (aiContextChatIds.value.length === 0) {
      return
    }

    window.dispatchEvent(new CustomEvent(OPEN_AI_CHAT_EVENT, {
      detail: { chatIds: aiContextChatIds.value },
    }))
  }

  function clearLongPressTimer() {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      longPressTimer = null
    }
  }

  function clearHintDismissTimer() {
    if (hintDismissTimer) {
      clearTimeout(hintDismissTimer)
      hintDismissTimer = null
    }
  }

  function startLongPress(chatId: number) {
    if (isSelectionMode.value) {
      return
    }

    clearLongPressTimer()
    longPressTriggeredChatId.value = null
    longPressTimer = setTimeout(() => {
      longPressTriggeredChatId.value = chatId
      enterSelectionMode(chatId)
    }, LONG_PRESS_DURATION)
  }

  function cancelLongPress() {
    clearLongPressTimer()
  }

  function consumeLongPressTrigger(chatId: number) {
    if (longPressTriggeredChatId.value !== chatId) {
      return false
    }

    longPressTriggeredChatId.value = null
    return true
  }

  function handleDesktopAddToAI(chatId: number) {
    enterSelectionMode(chatId)
  }

  function handleAIChatDrawerState(event: Event) {
    const customEvent = event as CustomEvent<{ open?: boolean }>
    isAIChatDrawerOpen.value = !!customEvent.detail?.open
  }

  if (typeof window !== 'undefined') {
    showAIContextHint.value = localStorage.getItem(AI_CONTEXT_HINT_STORAGE_KEY) !== '1'
  }

  onMounted(() => {
    window.addEventListener(AI_CHAT_DRAWER_STATE_EVENT, handleAIChatDrawerState)

    if (!showAIContextHint.value) {
      return
    }

    hintDismissTimer = setTimeout(() => {
      showAIContextHint.value = false
    }, 4500)
  })

  onBeforeUnmount(() => {
    clearLongPressTimer()
    clearHintDismissTimer()
    window.removeEventListener(AI_CHAT_DRAWER_STATE_EVENT, handleAIChatDrawerState)
  })

  return {
    aiContextCount,
    cancelLongPress,
    clearAIContextChats,
    consumeLongPressTrigger,
    handleDesktopAddToAI,
    isAIChatDrawerOpen,
    isChatInAIContext,
    isSelectionMode,
    openAIChatWithSelectedChats,
    showAIContextHint,
    startLongPress,
    toggleAIContextChat,
  }
}
