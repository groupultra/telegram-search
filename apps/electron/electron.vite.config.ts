import { resolve } from 'node:path'
import Vue from '@vitejs/plugin-vue'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import UnoCSS from 'unocss/vite'
import Components from 'unplugin-vue-components/vite'
import VueMacros from 'unplugin-vue-macros/vite'
import VueRouter from 'unplugin-vue-router/vite'
import Devtools from 'vite-plugin-vue-devtools'
import Layouts from 'vite-plugin-vue-layouts'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    plugins: [
      Devtools(),

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

      // https://github.com/posva/unplugin-vue-router
      VueRouter(),

      // https://github.com/antfu/vite-plugin-components
      Components({
        dts: true,
      }),

      // https://github.com/antfu/unocss
      // see uno.config.ts for config
      UnoCSS(),

      Layouts(),
    ],

    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@tg-search/common': resolve('../../packages/common/src'),
        '@tg-search/server': resolve('../../apps/server/src'),
        '@tg-search/client': resolve('../../packages/core/src'),
      },
    },

    // Proxy API requests to local development server
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          // Remove /api prefix when forwarding to target
          rewrite: path => path.replace(/^\/api/, ''),
        },
        '/ws': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          ws: true,
        },
      },
    },
  },
})
