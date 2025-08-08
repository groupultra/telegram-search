import DrizzleORMMigrations from '@proj-airi/unplugin-drizzle-orm-migrations/rolldown'
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/types.ts',
  ],
  dts: true,
  sourcemap: true,
  unused: true,
  fixedExtension: true,
  plugins: [
    DrizzleORMMigrations({
      root: '../..',
    }),
  ],
})
