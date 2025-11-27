import { resolve } from 'node:path'
import { env } from 'node:process'

import DrizzleORMMigrations from '@proj-airi/unplugin-drizzle-orm-migrations/vite'
import Vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import Info from 'unplugin-info/vite'
import Unused from 'unplugin-unused/vite'
import VueMacros from 'unplugin-vue-macros/vite'
import VueRouter from 'unplugin-vue-router/vite'
import Inspect from 'vite-plugin-inspect'
import Devtools from 'vite-plugin-vue-devtools'
import Layouts from 'vite-plugin-vue-layouts'

import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { splashScreen } from 'vite-plugin-splash-screen'

export default defineConfig({
  plugins: [
    Info({
      root: resolve(import.meta.dirname, '../..'),
    }),

    Inspect(),

    Unused({
      ignore: [
        '@iconify-json/lucide',
        '@node-rs/jieba-wasm32-wasi',
      ],
    }),

    Devtools(),

    // https://github.com/posva/unplugin-vue-router
    VueRouter(),

    Layouts(),

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

    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      devOptions: {
        enabled: true,
      },
      manifest: {
        name: 'Telegram Search',
        short_name: 'TG Search',
        description: 'Search and explore Telegram content with a rich progressive web experience.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        start_url: '/',
        display: 'standalone',
        lang: 'en',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        // https://github.com/moeru-ai/airi/blob/main/apps/stage-web/vite.config.ts#L136-L141
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/ws\//,
        ],
      },
    }),

    DrizzleORMMigrations({
      root: '../..',
    }),

    splashScreen({
      logoSrc: 'favicon.svg',
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
    exclude: [
      '@electric-sql/pglite',
    ],
    include: [
      'virtua/vue',
      'workbox-window',
      'date-fns',
      'echarts/charts',
      'echarts/components',
      'echarts/core',
      'echarts/renderers',
      'vue-echarts',
      'lottie-web',
    ],
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

  // Allow all hosts in preview mode for reverse proxy deployments by setting VITE_PREVIEW_ALLOW_ALL_HOSTS=true
  preview: {
    allowedHosts: env.VITE_PREVIEW_ALLOW_ALL_HOSTS === 'true' ? true : [],
  },
})
