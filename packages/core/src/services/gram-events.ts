import type { CoreContext } from '../context'

import { useConfig } from '@tg-search/common'
import { NewMessage } from 'telegram/events'

export type GramEventsService = ReturnType<typeof createGramEventsService>

export function createGramEventsService(ctx: CoreContext) {
  const { emitter, getClient } = ctx

  function registerGramEvents() {
    getClient().addEventHandler((event) => {
      if (event.message && useConfig().api.telegram.receiveMessage) {
        emitter.emit('gram:message:received', { message: event.message })
      }
    }, new NewMessage({}))
  }

  return {
    registerGramEvents,
  }
}
