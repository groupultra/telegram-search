import DrizzleORMMigrations from '@proj-airi/unplugin-drizzle-orm-migrations/rolldown'

import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/app.ts'],
  target: 'node22',
  platform: 'node',
  treeshake: true,
  unused: true,
  shims: true,
  fixedExtension: true,
  sourcemap: true,
  // unbundle: true,
  plugins: [
    DrizzleORMMigrations({
      root: '../..',
    }),
  ],
  external: [
    'vue',
    '@node-rs/jieba',
    '@node-rs/jieba-darwin-arm64',
    '@electric-sql/pglite',
  ],
  noExternal: [
    '@tg-search/core',
    '@tg-search/common',
    '@tg-search/common/node',
    /^telegram\//,
  ],
})
