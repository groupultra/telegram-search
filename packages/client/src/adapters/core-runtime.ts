import type { Config } from '@tg-search/common'
import type { CoreContext } from '@tg-search/core'
import type { Ref } from 'vue'

import { createCoreInstance, destroyCoreInstance } from '@tg-search/core'

import { getDB } from './core-db'

interface CoreRuntimeLogger {
  withError?: (error: unknown) => { error: (message: string) => void }
}

export interface CoreRuntime {
  /**
   * Get or lazily create a CoreContext instance.
   * This function is intentionally side-effect free beyond creating the
   * context; callers are responsible for any additional wiring.
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

  function getCtx(): CoreContext {
    if (!ctx) {
      if (!configRef.value)
        throw new Error('Core runtime is not initialized')

      // In browser runtime we do not wire metrics; pass undefined.
      ctx = createCoreInstance(getDB, configRef.value)
    }

    return ctx
  }

  return {
    getCtx,
    destroy,
  }
}
