import { defineEventa } from '@moeru/eventa'

// ============================================================================
// Bot commands (fire-and-forget)
// ============================================================================

/** Send a message via the Grammy bot */
export const botSendMessageEvent = defineEventa<{
  chatId: string
  content: string
  parseMode?: 'HTML' | 'MarkdownV2'
}>('bot:send:message')

// ============================================================================
// Bot notifications (core → client)
// ============================================================================

/** Bot connection status update */
export const botStatusEvent = defineEventa<{
  status: 'connected' | 'disconnected' | 'error'
  botUsername?: string
}>('bot:status')
