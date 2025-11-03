import type { Plugin } from 'vite'

/**
 * Vite plugin to display PGlite Inspector URL in startup prompt
 */
export function pgliteInspectorPrompt(): Plugin {
  return {
    name: 'pglite-inspector-prompt',
    apply: 'serve', // Only apply in dev server
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        // Delay to ensure it appears after other plugin prompts
        setTimeout(() => {
          const address = server.httpServer?.address()
          if (address && typeof address === 'object') {
            const protocol = server.config.server.https ? 'https' : 'http'
            const host = address.address === '::' ? 'localhost' : address.address
            const port = address.port
            const url = `${protocol}://${host}:${port}/__pglite_inspector`

            // Use the same color scheme as other Vite plugin prompts
            server.config.logger.info(
              `  ${'\x1B[32m➜\x1B[0m'}  ${'\x1B[1m'}PGlite Inspector:${'\x1B[0m'} ${'\x1B[36m'}${url}${'\x1B[0m'}`,
            )
          }
        }, 100)
      })
    },
  }
}
