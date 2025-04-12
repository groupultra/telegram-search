<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import DropdownMenu from '../components/ui/DropdownMenu.vue'
import { useDarkStore } from '../composables/dark'
import { useLanguage } from '../composables/useLanguage'
import { useSessionStore } from '../composables/v2/useSessionV2'

const router = useRouter()
const { isDark } = useDarkStore()
const { supportedLanguages, setLanguage, locale } = useLanguage()
const { t } = useI18n()

const showUserMenu = ref(false)
const showLanguageMenu = ref(false)
const showCommandMenu = ref(false)

const userMenuRef = ref<HTMLElement | null>(null)
const languageMenuRef = ref<HTMLElement | null>(null)
const commandMenuRef = ref<HTMLElement | null>(null)

const sessionStore = useSessionStore()
const { handleAuth } = sessionStore
const { activeSessionComputed } = storeToRefs(sessionStore)

// Use VueUse's onClickOutside to handle closing the menus
onClickOutside(userMenuRef, () => {
  showUserMenu.value = false
})

onClickOutside(languageMenuRef, () => {
  showLanguageMenu.value = false
})

onClickOutside(commandMenuRef, () => {
  showCommandMenu.value = false
})

// onMounted(async () => {
//   if (isConnected.value && !me.value) {
//     const { sendEvent } = getWsContext()
//     sendEvent('entity:getMe', undefined)
//   }
// })

// Handle logout
async function handleLogout() {
  showUserMenu.value = false
  handleAuth().logout()
  toast.success(t('header.logout_success'))
  router.push('/v2login')
}

// Handle login
async function handleLogin() {
  showUserMenu.value = false
  router.push('/v2login')
}

// Handle language change
function handleLanguageChange(langCode: string) {
  setLanguage(langCode)
  showLanguageMenu.value = false
  toast.success(t('header.language_changed'))
}
</script>

<template>
  <div class="min-h-screen" :class="{ dark: isDark }">
    <!-- Header -->
    <header class="sticky top-0 z-50 border-b bg-white transition-colors duration-300 dark:border-gray-800 dark:bg-gray-900">
      <div class="mx-auto h-14 flex items-center justify-between px-4 container">
        <router-link to="/" class="text-lg font-semibold transition-colors duration-300 dark:text-white">
          {{ $t('header.title') }}
        </router-link>

        <div class="flex items-center gap-4">
          <IconButton
            icon="i-lucide-download"
            with-transition
            :aria-label="$t('header.export_command')"
            @click="router.push('/commands/export')"
          />

          <IconButton
            icon="i-lucide-folder-sync"
            with-transition
            :aria-label="$t('header.sync_command')"
            @click="router.push('/commands/sync')"
          />

          <IconButton
            icon="i-lucide-folder-open"
            with-transition
            :aria-label="$t('header.embed_command')"
            @click="router.push('/commands/embed')"
          />

          <IconButton
            icon="i-lucide-settings"
            with-transition
            :aria-label="$t('header.setting')"
            @click="router.push('/settings')"
          />

          <!-- User menu -->
          <DropdownMenu
            icon="i-lucide-user"
            :label="$t('header.usermenu')"
          >
            <div v-if="activeSessionComputed?.me" class="px-4 py-2 text-sm text-gray-700 dark:text-gray-200">
              <div>{{ activeSessionComputed.me.firstName }} {{ activeSessionComputed.me.lastName }}</div>
              <div class="text-xs text-gray-500">
                @{{ activeSessionComputed.me.username }}
              </div>
            </div>

            <div v-if="activeSessionComputed?.me?.username" class="my-2 border-b border-gray-200 dark:border-gray-700" />

            <button
              v-if="!activeSessionComputed?.isConnected"
              class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              @click="handleLogin"
            >
              <div class="flex items-center">
                <div class="i-lucide-log-in mr-2 h-4 w-4" />
                <span>{{ $t('header.login') }}</span>
              </div>
            </button>

            <button
              v-if="activeSessionComputed?.isConnected"
              class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              @click="handleLogout"
            >
              <div class="flex items-center">
                <div class="i-lucide-log-out mr-2 h-4 w-4" />
                <span>{{ $t('header.logout') }}</span>
              </div>
            </button>
          </DropdownMenu>

          <!-- Language switcher -->
          <DropdownMenu
            icon="i-lucide-languages"
            :label="$t('header.language')"
          >
            <button
              v-for="lang in supportedLanguages"
              :key="lang.code"
              class="w-full flex items-center justify-between px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              @click="handleLanguageChange(lang.code)"
            >
              <span>{{ lang.name }}</span>
              <span v-if="locale === lang.code" class="i-lucide-circle-check h-4 w-4" />
            </button>
          </DropdownMenu>

          <ThemeToggle />
        </div>
      </div>
    </header>

    <!-- Main content -->
    <main class="mx-auto bg-white p-4 transition-colors duration-300 container dark:bg-gray-900">
      <slot />
    </main>

    <!-- Global Dialog Wrapper -->
    <div class="pointer-events-none fixed left-0 top-0 z-100 h-screen w-screen">
      <slot name="dialog" />
    </div>
  </div>
</template>

<style>
:deep(dialog) {
  pointer-events: auto;
}

/* Menu animations */
.menu-enter-active {
  animation: menu-in 0.2s ease-out;
}

.menu-leave-active {
  animation: menu-out 0.2s ease-in;
}

@keyframes menu-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes menu-out {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-8px);
  }
}
</style>
