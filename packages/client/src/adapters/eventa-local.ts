import type { EventContext } from '@moeru/eventa'
import type { CoreContext, TelegramApplicationRuntime } from '@tg-search/core'

import type { ApplicationBridge } from '../types/bridge'

import { createContext, defineInvokes } from '@moeru/eventa'
import { createTelegramApplicationRuntime, registerApplicationHandlers } from '@tg-search/core'
import { chatContracts, messageContracts, statsContracts } from '@tg-search/protocol'

export function createLocalApplicationBridge(
  getCoreContext: () => CoreContext,
  options: { createRuntime?: typeof createTelegramApplicationRuntime } = {},
): ApplicationBridge & { dispose: () => Promise<void>, reset: () => Promise<void> } {
  const createRuntime = options.createRuntime ?? createTelegramApplicationRuntime
  function createEventaState() {
    const context: EventContext<any, any> = createContext()
    return {
      context,
      chats: defineInvokes(context, chatContracts),
      messages: defineInvokes(context, messageContracts),
      stats: defineInvokes(context, statsContracts),
    }
  }

  let eventa = createEventaState()
  let runtime: TelegramApplicationRuntime | undefined
  let unregister: (() => void) | undefined

  function ensureRuntime() {
    if (!runtime) {
      runtime = createRuntime({ context: getCoreContext() })
      unregister = registerApplicationHandlers(eventa.context, runtime)
    }
  }

  async function reset() {
    unregister?.()
    unregister = undefined
    await runtime?.dispose()
    runtime = undefined
    eventa.context.abort(new Error('Local application bridge reset'))
    eventa = createEventaState()
  }

  return {
    listChats: (input) => {
      ensureRuntime()
      return eventa.chats.list(input)
    },
    listRemoteMessages: (input) => {
      ensureRuntime()
      return eventa.messages.listRemote(input)
    },
    queryLocalMessages: (input) => {
      ensureRuntime()
      return eventa.messages.queryLocal(input)
    },
    searchLocalMessages: (input) => {
      ensureRuntime()
      return eventa.messages.searchLocal(input)
    },
    getLocalMessageContext: (input) => {
      ensureRuntime()
      return eventa.messages.contextLocal(input)
    },
    getLocalStats: (input) => {
      ensureRuntime()
      return eventa.stats.get(input)
    },
    reset,
    dispose: reset,
  }
}
