import DrizzleORMMigrations from '@proj-airi/unplugin-drizzle-orm-migrations/vite'
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
})
