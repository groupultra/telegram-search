import type { Config } from '@tg-search/common'
import type { CoreContext } from '@tg-search/core'
import type { Ref } from 'vue'

import { createCoreInstance, destroyCoreInstance } from '@tg-search/core'

import { getDB } from './core-db'
import { getMediaBinaryProvider } from './core-media-opfs'

interface CoreRuntimeLogger {
  withError?: (error: unknown) => { error: (message: string) => void }
}

export interface CoreRuntime {
  /**
   * Asynchronously create and cache the CoreContext instance.
   * Must be called (and awaited) before getCtx().
   */
  initCtx: () => Promise<CoreContext>

  /**
   * Get the previously initialized CoreContext instance.
   * Throws if initCtx() has not been called.
   */
  getCtx: () => CoreContext

  /**
   * Destroy the current CoreContext instance, if any, and reset internal state.
   */
  destroy: () => Promise<void>
}

export function createCoreRuntime(
  configRef: Ref<Config>,
  logger?: CoreRuntimeLogger,
): CoreRuntime {
  let ctx: CoreContext | undefined

  async function destroy() {
    if (!ctx)
      return

    try {
      await destroyCoreInstance(ctx)
    }
    catch (error) {
      logger?.withError?.(error).error('Failed to destroy CoreContext')
    }
    finally {
      ctx = undefined
    }
  }

  async function initCtx(): Promise<CoreContext> {
    if (ctx)
      return ctx

    if (!configRef.value)
      throw new Error('Core runtime is not initialized')

    // In browser runtime we do not wire metrics; pass undefined.
    ctx = await createCoreInstance(getDB, configRef.value, getMediaBinaryProvider())
    return ctx
  }

  function getCtx(): CoreContext {
    if (!ctx) {
      throw new Error('CoreContext not initialized. Call initCtx() first.')
    }

    return ctx
  }

  return {
    initCtx,
    getCtx,
    destroy,
  }
}
