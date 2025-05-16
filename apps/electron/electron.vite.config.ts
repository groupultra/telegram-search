import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import Vue from '@vitejs/plugin-vue'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { resolve } from 'pathe'
import UnoCSS from 'unocss/vite'
import Components from 'unplugin-vue-components/vite'
import VueMacros from 'unplugin-vue-macros/vite'
import VueRouter from 'unplugin-vue-router/vite'
import Devtools from 'vite-plugin-vue-devtools'
import Layouts from 'vite-plugin-vue-layouts'

const alias = {
  '@renderer': resolve('src/renderer/src'),
  '@tg-search/server': resolve('../../apps/server/src'),
  '@tg-search/common': resolve('../../packages/common/src'),
  '@tg-search/core': resolve('../../packages/core/src'),
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({
      include: [
        'nodejieba',
      ],
      exclude: [
        ...Object.keys(alias),
      ],
    })],
    resolve: {
      alias: {
        ...alias,
        ...Object.fromEntries(['mock-aws-s3', 'aws-sdk', 'nock'].map(dep => ([
          dep,
          `${resolve(fileURLToPath(dirname(import.meta.url)), 'stubs', 'empty.cjs')}`,
        ]))),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias },
  },
  renderer: {
    plugins: [
      externalizeDepsPlugin(),

      Devtools(),

      // https://github.com/posva/unplugin-vue-router
      VueRouter({
        routesFolder: 'src/renderer/src/pages',
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

      // https://github.com/antfu/vite-plugin-components
      Components({
        dts: true,
      }),

      // https://github.com/antfu/unocss
      // see uno.config.ts for config
      UnoCSS(),

      Layouts(),
    ],

    resolve: { alias },

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
