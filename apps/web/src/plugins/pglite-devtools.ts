import type { App } from 'vue'

import { PGLITE_DEVTOOLS_SETUP_KEY } from '@tg-search/client'
import { setupPGliteDevtools } from '@unbird/pglite-inspector'

export function createPGliteDevtoolsPlugin() {
  return {
    install(app: App) {
      // Dev-only plugin; no-op in production builds.
      if (!import.meta.env.DEV)
        return

      app.provide(PGLITE_DEVTOOLS_SETUP_KEY, (db: any) => {
        setupPGliteDevtools({ app, db })
      })
    },
  }
}
