import { resolve } from 'node:path'
import { env } from 'node:process'

import DrizzleORMMigrations from '@proj-airi/unplugin-drizzle-orm-migrations/vite'
import Vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import Unused from 'unplugin-unused/vite'
import VueMacros from 'unplugin-vue-macros/vite'
import VueRouter from 'unplugin-vue-router/vite'
import { defineConfig } from 'vite'
import Inspect from 'vite-plugin-inspect'
import Devtools from 'vite-plugin-vue-devtools'
import Layouts from 'vite-plugin-vue-layouts'

export default defineConfig({
  plugins: [
    Inspect(),

    Unused({
      ignore: [
        '@iconify-json/lucide',
        '@node-rs/jieba-wasm32-wasi',
      ],
    }),

    Devtools(),

    // https://github.com/posva/unplugin-vue-router
    VueRouter({
      routesFolder: '../../packages/stage-ui/src/pages',
    }),

    Layouts({
      layoutsDirs: '../../packages/stage-ui/src/layouts',
    }),

    VueMacros({
      defineOptions: false,
      defineModels: false,
      plugins: {
        vue: Vue({
          script: {
            propsDestructure: true,
            defineModel: true,
          },
        }),
      },
    }),

    // https://github.com/antfu/unocss
    // see uno.config.ts for config
    UnoCSS(),

    DrizzleORMMigrations({
      root: '../..',
    }),
  ],

  resolve: {
    alias: {
      '@tg-search/common': resolve(import.meta.dirname, '../../packages/common/src'),
      '@tg-search/core': resolve(import.meta.dirname, '../../packages/core/src'),
      '@tg-search/client': resolve(import.meta.dirname, '../../packages/client/src'),

      // telegram browser version, more detail -> https://t.me/gramjs/13
      'telegram': resolve(import.meta.dirname, './node_modules/telegram'),
    },
  },

  optimizeDeps: {
    exclude: ['@electric-sql/pglite'],
  },

  build: {
    rollupOptions: {
      // https://github.com/rollup/rollup/issues/6012#issuecomment-3065953828
      external: ['postgres'],
    },
  },

  envDir: '../..',

  // Proxy API requests to local development server
  server: {
    proxy: {
      '/api': {
        target: env.BACKEND_URL ?? 'http://localhost:3000',
        changeOrigin: true,
        // Remove /api prefix when forwarding to target
        rewrite: path => path.replace(/^\/api/, ''),
      },
      '/ws': {
        target: env.BACKEND_URL ?? 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
