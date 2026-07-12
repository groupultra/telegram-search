import type { EventContext } from '@moeru/eventa'
import type { CoreContext, TelegramApplicationRuntime } from '@tg-search/core'

import type { ApplicationBridge } from '../types/bridge'

import { createContext, defineInvokes } from '@moeru/eventa'
import { createTelegramApplicationRuntime, registerApplicationHandlers } from '@tg-search/core'
import { chatContracts, messageContracts, statsContracts } from '@tg-search/protocol'

export function createLocalApplicationBridge(getCoreContext: () => CoreContext): ApplicationBridge & { dispose: () => Promise<void> } {
  const eventContext: EventContext<any, any> = createContext()
  const chatInvokes = defineInvokes(eventContext, chatContracts)
  const messageInvokes = defineInvokes(eventContext, messageContracts)
  const statsInvokes = defineInvokes(eventContext, statsContracts)
  let runtime: TelegramApplicationRuntime | undefined
  let unregister: (() => void) | undefined

  function ensureRuntime() {
    if (!runtime) {
      runtime = createTelegramApplicationRuntime({ context: getCoreContext() })
      unregister = registerApplicationHandlers(eventContext, runtime)
    }
  }

  return {
    listChats: (input) => {
      ensureRuntime()
      return chatInvokes.list(input)
    },
    listRemoteMessages: (input) => {
      ensureRuntime()
      return messageInvokes.listRemote(input)
    },
    queryLocalMessages: (input) => {
      ensureRuntime()
      return messageInvokes.queryLocal(input)
    },
    searchLocalMessages: (input) => {
      ensureRuntime()
      return messageInvokes.searchLocal(input)
    },
    getLocalMessageContext: (input) => {
      ensureRuntime()
      return messageInvokes.contextLocal(input)
    },
    getLocalStats: (input) => {
      ensureRuntime()
      return statsInvokes.get(input)
    },
    dispose: async () => {
      unregister?.()
      await runtime?.dispose()
      eventContext.abort()
    },
  }
}
