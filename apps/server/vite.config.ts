import DrizzleORMMigrations from '@proj-airi/unplugin-drizzle-orm-migrations/vite'
import { resolve } from 'pathe'
import { defineConfig } from 'vite'

// NOTE: Since the alias for the core package has been set,
// the packaged code cannot be used directly,
// and the plugin needs to be reconfigured.
export default defineConfig({
  plugins: [
    DrizzleORMMigrations({
      root: '../..',
    }),
  ],

  optimizeDeps: {
    include: ['@tg-search/core', '@tg-search/common'],
  },

  resolve: {
    alias: {
      '@tg-search/common': resolve(import.meta.dirname, '../../packages/common/src'),
      '@tg-search/core': resolve(import.meta.dirname, '../../packages/core/src'),
    },
  },
})
