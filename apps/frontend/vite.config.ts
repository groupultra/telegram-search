import { resolve } from 'node:path'
import { env } from 'node:process'

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

    Unused(),

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
  ],

  resolve: {
    alias: {
      telegram: resolve(import.meta.dirname, 'node_modules/telegram'),
    },
    mainFields: ['browser', 'module', 'main'],
  },
  optimizeDeps: {
    exclude: ['@electric-sql/pglite'],
    include: ['@tg-search/common'],
  },
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
