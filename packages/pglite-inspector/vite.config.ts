import { resolve } from 'node:path'

import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'PGliteDevtools',
      fileName: 'index',
      formats: ['es'],
    },
    rollupOptions: {
      external: ['vue', '@vue/devtools-api', '@electric-sql/pglite'],
      output: {
        globals: {
          'vue': 'Vue',
          '@vue/devtools-api': 'DevtoolsApi',
          '@electric-sql/pglite': 'PGlite',
        },
      },
    },
  },
})
