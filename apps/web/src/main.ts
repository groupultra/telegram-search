import NProgress from 'nprogress'

import { autoAnimatePlugin } from '@formkit/auto-animate/vue'
import { initLogger, LoggerFormat, LoggerLevel } from '@guiiai/logg'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia } from 'pinia'
import { setupLayouts } from 'virtual:generated-layouts'
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { routes as generatedRoutes } from 'vue-router/auto-routes'

import App from './App.vue'

import { i18n } from './modules/i18n'

import '@unocss/reset/tailwind.css'
import 'nprogress/nprogress.css'
import 'uno.css'
import 'vue-sonner/style.css'
import './styles/main.css'

initLogger(import.meta.env.DEV ? LoggerLevel.Debug : LoggerLevel.Verbose, LoggerFormat.Pretty)

const app = createApp(App)

const pinia = createPinia()
const routes = setupLayouts(generatedRoutes.filter((route) => {
  if (route.path === '/settings'
    && import.meta.env.VITE_DISABLE_SETTINGS === 'true') {
    return false
  }
  return true
}))
const router = createRouter({
  routes,
  history: createWebHistory(import.meta.env.BASE_URL),
})

// Configure NProgress
NProgress.configure({ showSpinner: false })

// Add router navigation guards for NProgress
router.beforeEach(() => {
  NProgress.start()
})

router.afterEach(() => {
  NProgress.done()
})

router.onError(() => {
  NProgress.done()
})

app.use(i18n)
app.use(router)
app.use(VueQueryPlugin)
app.use(pinia)
app.use(autoAnimatePlugin)
app.mount('#app')
