import { VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'
import { createRouter, createWebHistory } from 'vue-router'
import { routes } from 'vue-router/auto-routes'

import App from './App.vue'
import en from './languages/en'
import es from './languages/es'
import fr from './languages/fr'
import ja from './languages/ja'
import ru from './languages/ru'
import zhCN from './languages/zhCN'
import zhHK from './languages/zhHK'
import '@unocss/reset/tailwind.css'
import './styles/main.css'
import 'uno.css'

const app = createApp(App)

const pinia = createPinia()
const router = createRouter({
  routes,
  history: createWebHistory(import.meta.env.BASE_URL),
})

const i18n = createI18n({
  locale: 'en',
  globalInjection: true,
  messages: {
    en,
    zhCN,
    fr,
    zhHK,
    es,
    ru,
    ja,
  },
})
app.use(i18n)
app.use(router)
app.use(VueQueryPlugin)
app.use(pinia)
app.mount('#app')
