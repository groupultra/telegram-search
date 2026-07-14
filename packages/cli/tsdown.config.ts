import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  clean: true,
  dts: false,
  inlineOnly: false,
  external: [
    /^@electric-sql\/pglite/,
    /^@node-rs\/jieba/,
    '@node-rs/jieba-darwin-arm64',
  ],
  noExternal: [
    /^@tg-search\//,
    /^telegram(?:\/|$)/,
  ],
  banner: { js: '#!/usr/bin/env node' },
})
