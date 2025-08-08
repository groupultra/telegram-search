import DrizzleORMMigrations from '@proj-airi/unplugin-drizzle-orm-migrations/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    DrizzleORMMigrations({
      root: '../..',
    }),
  ],
})
