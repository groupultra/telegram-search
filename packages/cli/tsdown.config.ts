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
  // NOTICE: GramJS bundles store2, which probes browser storage globals at import
  // time. Mark them unavailable in this Node-only bundle so Node 25+ does not
  // emit an experimental web storage warning for every CLI command.
  define: {
    localStorage: 'undefined',
    sessionStorage: 'undefined',
  },
  banner: { js: '#!/usr/bin/env node' },
})
