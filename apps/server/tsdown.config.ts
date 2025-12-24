import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  target: 'node22',
  platform: 'node',
  treeshake: true,
  unused: true,
  shims: true,
  fixedExtension: true,
  sourcemap: true,
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
