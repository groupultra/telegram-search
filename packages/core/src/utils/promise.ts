import type { Eventa, EventContext } from '@moeru/eventa'

/**
 * Type-safe wrappers around Eventa's `on`/`once` that unwrap the `body` payload.
 *
 * Eventa's `Eventa<P>` interface marks `body` as optional (`body?: P`), but body
 * is always present when events are emitted with a payload. These helpers eliminate
 * the need for non-null assertions (`body!`) at every handler site.
 */
export function onEvent<P>(
  ctx: EventContext<any, any>,
  event: Eventa<P>,
  handler: (body: P) => unknown,
): () => void {
  return ctx.on(event, payload => handler(payload.body as P))
}

export function onceEvent<P>(
  ctx: EventContext<any, any>,
  event: Eventa<P>,
  handler: (body: P) => unknown,
): () => void {
  return ctx.once(event, payload => handler(payload.body as P))
}

export function waitForEvent<P>(
  ctx: EventContext<any, any>,
  event: Eventa<P>,
): Promise<P> {
  return new Promise((resolve) => {
    ctx.once(event, ({ body }) => {
      resolve(body as P)
    })
  })
}
