import type { Eventa, EventContext } from '@moeru/eventa'

export function waitForEvent<P>(
  ctx: EventContext,
  event: Eventa<P>,
): Promise<P> {
  return new Promise((resolve) => {
    ctx.once(event, ({ body }) => {
      resolve(body)
    })
  })
}
