import type { InjectionKey } from 'vue'

import { inject } from 'vue'

/**
 * Dev-only hook to allow the application shell (apps/web) to register a
 * callback that wires up PGlite DevTools once a database instance exists.
 *
 * Kept intentionally untyped (unknown) here so that the client package
 * does not take a hard dependency on PGlite. The concrete type is only
 * known by the caller in apps/web.
 */
export type SetupPGliteDevtoolsFn = (db: unknown) => void

export const PGLITE_DEVTOOLS_SETUP_KEY: InjectionKey<SetupPGliteDevtoolsFn> = Symbol('PGliteDevtoolsSetup')

export function useSetupPGliteDevtools(): SetupPGliteDevtoolsFn | undefined {
  // This will be provided by a dev-only plugin in apps/web.
  // In non-dev builds or non-browser environments this will simply be undefined.
  return inject(PGLITE_DEVTOOLS_SETUP_KEY, undefined)
}
