import { autoAnimatePlugin } from '@formkit/auto-animate/vue'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { App, en, zhCN } from '@tg-search/stage-ui'
import { createPinia } from 'pinia'
import { setupLayouts } from 'virtual:generated-layouts'
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHistory } from 'vue-router'
import { routes as generatedRoutes } from 'vue-router/auto-routes'

import { initConfig, updateConfig, useConfig } from '../../../packages/common/src/browser/config'

import '@unocss/reset/tailwind.css'
import 'uno.css'
import 'vue-sonner/style.css'
import '@tg-search/stage-ui/styles/main.css'

const app = createApp(App)

const has_config = localStorage.getItem('config')
if (!has_config) {
  initConfig()
  const config = useConfig()
  config.api.telegram.apiId = import.meta.env.VITE_TELEGRAM_APP_ID
  config.api.telegram.apiHash = import.meta.env.VITE_TELEGRAM_APP_HASH
  updateConfig(config)
}

const pinia = createPinia()
const routes = setupLayouts(generatedRoutes)
const router = createRouter({
  routes,
  history: createWebHistory(import.meta.env.BASE_URL),
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  globalInjection: true,
  messages: {
    en,
    zhCN,
  },
})

app.use(i18n)
app.use(router)
app.use(VueQueryPlugin)
app.use(pinia)
app.use(autoAnimatePlugin)
app.mount('#app')
