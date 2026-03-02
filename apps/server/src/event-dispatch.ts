/**
 * Server-side event dispatch for bridging JSON-over-WebSocket messages to Eventa events.
 *
 * Uses shared event maps from @tg-search/core and adds server-specific
 * dispatch logic (invoking RPCs and sending responses back to the calling peer).
 */
import type { CoreContext } from '@tg-search/core'
import type { Peer } from 'crossws'

import { defineInvoke } from '@moeru/eventa'
import { fireAndForgetEvents, isCoreEvent, rpcEvents } from '@tg-search/core'

import { sendWsEvent } from './events'

export { isCoreEvent }

/**
 * Dispatch an incoming client event to the core Eventa context.
 *
 * - Fire-and-forget events are emitted directly.
 * - RPC invokes are awaited and their response is sent back to the calling peer.
 */
export async function dispatchClientEvent(
  ctx: CoreContext,
  eventName: string,
  data: any,
  peer: Peer,
): Promise<void> {
  // Try RPC invoke first
  const rpc = rpcEvents.get(eventName)
  if (rpc) {
    const invoke = defineInvoke(ctx.ctx, rpc.invoke)
    const result = await invoke(data)
    sendWsEvent(peer, rpc.responseEvent, result)
    return
  }

  // Try fire-and-forget
  const event = fireAndForgetEvents.get(eventName)
  if (event) {
    ctx.ctx.emit(event, data)
  }

  // Unknown event — skip silently (may be server-only)
}
