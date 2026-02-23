import type { TelegramClient } from 'telegram'

import type { CoreDB } from './db'
import type { EventHandler } from './event-handlers'

import { generateDefaultConfig } from '@tg-search/common'
import { describe, expect, it, vi } from 'vitest'

import { createCoreInstance, destroyCoreInstance } from './instance'

describe('destroyCoreInstance', () => {
  it('waits for registered cleanup hooks before disconnecting telegram client', async () => {
    let releaseCleanup!: () => void
    let cleanupCompleted = false

    const cleanupPromise = new Promise<void>((resolve) => {
      releaseCleanup = resolve
    })

    const handler: EventHandler = () => {
      return async () => {
        await cleanupPromise
        cleanupCompleted = true
      }
    }

    const disconnect = vi.fn(async () => {
      expect(cleanupCompleted).toBe(true)
    })

    const ctx = createCoreInstance(
      () => ({} as CoreDB),
      generateDefaultConfig(),
      undefined,
      undefined,
      undefined,
      {
        eventHandlers: [handler],
      },
    )

    ctx.setClient({ connected: true, disconnect } as unknown as TelegramClient)

    const destroyTask = destroyCoreInstance(ctx)
    await Promise.resolve()
    expect(disconnect).not.toHaveBeenCalled()

    releaseCleanup()
    await destroyTask

    expect(disconnect).toHaveBeenCalledTimes(1)
  })

  it('runs cleanup hooks for all registered handlers before disconnecting', async () => {
    const cleanupCalls: string[] = []
    let releaseSecondCleanup!: () => void

    const secondCleanupPending = new Promise<void>((resolve) => {
      releaseSecondCleanup = resolve
    })

    const firstHandler: EventHandler = () => {
      return async () => {
        cleanupCalls.push('first')
      }
    }

    const secondHandler: EventHandler = () => {
      return async () => {
        await secondCleanupPending
        cleanupCalls.push('second')
      }
    }

    const disconnect = vi.fn(async () => {
      expect(cleanupCalls).toEqual(['first', 'second'])
    })

    const ctx = createCoreInstance(
      () => ({} as CoreDB),
      generateDefaultConfig(),
      undefined,
      undefined,
      undefined,
      {
        eventHandlers: [firstHandler, secondHandler],
      },
    )

    ctx.setClient({ connected: true, disconnect } as unknown as TelegramClient)

    const destroyTask = destroyCoreInstance(ctx)
    await Promise.resolve()
    expect(disconnect).not.toHaveBeenCalled()

    releaseSecondCleanup()
    await destroyTask

    expect(cleanupCalls).toEqual(['first', 'second'])
    expect(disconnect).toHaveBeenCalledTimes(1)
  })
})
