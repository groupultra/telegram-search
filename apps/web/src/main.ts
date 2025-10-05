import { autoAnimatePlugin } from '@formkit/auto-animate/vue'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia } from 'pinia'
import { setupLayouts } from 'virtual:generated-layouts'
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { routes as generatedRoutes } from 'vue-router/auto-routes'

import App from './App.vue'
import { i18n } from './modules/i18n'

import '@unocss/reset/tailwind.css'
import 'uno.css'
import 'vue-sonner/style.css'
import './styles/main.css'

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

app.use(i18n)
app.use(router)
app.use(VueQueryPlugin)
app.use(pinia)
app.use(autoAnimatePlugin)
app.mount('#app')
