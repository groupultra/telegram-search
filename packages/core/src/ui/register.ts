import type { Logger } from '@guiiai/logg'
import type { Eventa, EventContext } from '@moeru/eventa'
import type { GenericSchema } from 'valibot'

import type { CoreContext } from '../context'
import type { UiCommandInput, UiCommandType, UiCoreNotificationType, UiNotificationData } from './contracts'

import { useLogger } from '@guiiai/logg'
import { safeParse } from 'valibot'

import { uiCommandContracts, uiCoreNotificationTypes, uiNotificationContracts } from './contracts'

export interface UiHandlerOptions {
  logger?: Logger
  /**
   * Runs for each validated command. Call `forward` to emit it on the core
   * emitter; skip the call to handle the command yourself. Defaults to
   * forwarding unchanged.
   */
  onCommand?: <T extends UiCommandType>(type: T, input: UiCommandInput<T>, forward: (input: UiCommandInput<T>) => void) => void
  /**
   * Maps a core notification before it reaches the client. Defaults to
   * passing it unchanged.
   */
  prepareNotification?: <T extends UiCoreNotificationType>(type: T, data: UiNotificationData<T>) => UiNotificationData<T>
}

/**
 * Binds the UI contracts to one client's Eventa context and one account's core.
 *
 * Commands are validated and emitted on the core emitter; listed core events
 * are forwarded back as notifications. Returns a function that removes every
 * listener this call added, on both contexts.
 */
export function registerUiHandlers(eventa: EventContext<any, any>, core: CoreContext, options: UiHandlerOptions = {}): () => void {
  const logger = (options.logger ?? useLogger()).withContext('core:ui')
  const disposers: Array<() => void> = []

  for (const type of Object.keys(uiCommandContracts) as UiCommandType[]) {
    // The loop handles every command type at once, so the per-type payload
    // types are widened here; `UiHandlerOptions` keeps them for callers.
    const contract = uiCommandContracts[type] as unknown as { eventa: Eventa<unknown>, schema: GenericSchema<unknown, UiCommandInput<UiCommandType>> }
    disposers.push(eventa.on(contract.eventa, ({ body }) => {
      const parsed = safeParse(contract.schema, body)
      if (!parsed.success) {
        logger.withFields({ type, issues: parsed.issues.map(issue => issue.message) }).warn('Dropped invalid UI command')
        return
      }

      const forward = (input: typeof parsed.output) => {
        (core.emitter.emit as (event: string, data: unknown) => boolean)(type, input)
      }
      if (options.onCommand)
        options.onCommand(type, parsed.output, forward)
      else
        forward(parsed.output)
    }))
  }

  for (const type of uiCoreNotificationTypes) {
    disposers.push(subscribeCoreEvent(core, type, (data: UiNotificationData<typeof type>) => {
      const prepared = options.prepareNotification ? options.prepareNotification(type, data) : data
      void eventa.emit(uiNotificationContracts[type], prepared).catch((error: unknown) => {
        logger.withError(error).withFields({ type }).warn('Failed to send UI notification')
      })
    }))
  }

  return () => {
    for (const dispose of disposers.splice(0))
      dispose()
  }
}

type CoreSubscriber = (data: never) => void
const coreSubscribers = new WeakMap<CoreContext, Map<string, Set<CoreSubscriber>>>()

/**
 * Subscribes to a core event and returns an unsubscribe function.
 *
 * NOTICE: `createCoreContext` (and the server's tracing wrapper) replace
 * `emitter.on` with a version that registers a wrapper around the listener,
 * so `emitter.off(listener)` cannot remove it. Each context therefore gets
 * one permanent fan-out listener per event, and peers come and go from its
 * subscriber set.
 */
function subscribeCoreEvent(core: CoreContext, type: string, subscriber: CoreSubscriber): () => void {
  let byType = coreSubscribers.get(core)
  if (!byType) {
    byType = new Map()
    coreSubscribers.set(core, byType)
  }

  let subscribers = byType.get(type)
  if (!subscribers) {
    const created = new Set<CoreSubscriber>()
    subscribers = created
    byType.set(type, created)
    const on = core.emitter.on as (event: string, fn: (data: never) => void) => unknown
    on.call(core.emitter, type, (data: never) => {
      for (const fn of created)
        fn(data)
    })
  }

  subscribers.add(subscriber)
  return () => subscribers.delete(subscriber)
}
