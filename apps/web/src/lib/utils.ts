import type { ClassValue } from 'clsx'

import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type StartViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => {
    ready: Promise<void>
  }
}

export async function runThemeAppearanceTransition(
  event: Event | undefined,
  toggle: () => void | Promise<void>,
) {
  const doc = document as StartViewTransitionDocument
  const supportsTransition = typeof doc.startViewTransition === 'function'
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (!supportsTransition) {
    await toggle()
    return
  }

  const pointerEvent = event instanceof MouseEvent ? event : undefined
  const x = pointerEvent?.clientX ?? window.innerWidth / 2
  const y = pointerEvent?.clientY ?? window.innerHeight / 2
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  )

  const transition = doc.startViewTransition(async () => {
    await toggle()
  })

  await transition.ready

  document.documentElement.animate(
    {
      clipPath: [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`,
      ],
    },
    {
      duration: 400,
      easing: 'ease-out',
      pseudoElement: '::view-transition-new(root)',
    },
  )
}
