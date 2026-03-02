import type { Api } from 'telegram'

import { defineEventa } from '@moeru/eventa'

/** Real-time message received from Telegram */
export const gramMessageReceivedEvent = defineEventa<{
  message: Api.Message
  pts?: number
  date?: number
  isChannel: boolean
}>('gram:message:received')
