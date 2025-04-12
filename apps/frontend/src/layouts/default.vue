<script setup lang="ts">
import type { UserInfoResponse } from '@tg-search/server'
import { onClickOutside } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import DropdownMenu from '../components/ui/DropdownMenu.vue'
import { useDarkStore } from '../composables/dark'
import { useLanguage } from '../composables/useLanguage'
import { useSession } from '../composables/useSession'
import { useAuth } from '../store/useAuth'

const router = useRouter()
const { logout, getMeInfo } = useAuth()
const { isDark } = useDarkStore()
const { checkConnection } = useSession()
const { isConnected } = storeToRefs(useSession())
const { supportedLanguages, setLanguage, locale } = useLanguage()
const { t } = useI18n()
const showUserMenu = ref(false)
const showLanguageMenu = ref(false)
const showCommandMenu = ref(false)
const userMenuRef = ref<HTMLElement | null>(null)
const languageMenuRef = ref<HTMLElement | null>(null)
const commandMenuRef = ref<HTMLElement | null>(null)
const userInfo = ref<UserInfoResponse | null>(null)

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

// Check if user is logged in and get user info
onMounted(async () => {
  await checkConnection(false)
  if (isConnected.value) {
    try {
      userInfo.value = await getMeInfo()
    }
    catch (err) {
      console.error('Failed to get user info:', err)
    }
  }
})

// Handle logout
async function handleLogout() {
  showUserMenu.value = false
  const success = await logout()
  if (success) {
    userInfo.value = null
    toast.success(t('header.logout_success'))
    router.push('/login')
  }
  else {
    toast.error(t('header.logout_failed'))
  }
}

// Handle login
async function handleLogin() {
  showUserMenu.value = false
  router.push('/login')
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
            aria-label="{{$t('header.export_command')}}"
            @click="router.push('/commands/export')"
          />

          <IconButton
            icon="i-lucide-folder-sync"
            with-transition
            aria-label="{{$t('header.sync_command')}}"
            @click="router.push('/commands/sync')"
          />

          <IconButton
            icon="i-lucide-folder-open"
            with-transition
            aria-label="{{$t('header.embed_command')}}"
            @click="router.push('/commands/embed')"
          />

          <IconButton
            icon="i-lucide-settings"
            with-transition
            aria-label="{{$t('header.setting')}}"
            @click="router.push('/settings')"
          />

          <!-- User menu -->
          <DropdownMenu
            icon="i-lucide-user"
            :label="$t('header.usermenu')"
          >
            <div v-if="userInfo" class="px-4 py-2 text-sm text-gray-700 dark:text-gray-200">
              <div>{{ userInfo.firstName }} {{ userInfo.lastName }}</div>
              <div class="text-xs text-gray-500">
                @{{ userInfo.username }}
              </div>
            </div>

            <div class="my-2 border-b border-gray-200 dark:border-gray-700" />

            <button
              v-if="!isConnected"
              class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              @click="handleLogin"
            >
              <div class="flex items-center">
                <div class="i-lucide-log-in mr-2 h-4 w-4" />
                <span>{{ $t('header.login') }}</span>
              </div>
            </button>

            <button
              v-if="isConnected"
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
    <div class="dialog-wrapper">
      <slot name="dialog" />
    </div>
  </div>
</template>

<style scoped>
.dialog-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 100;
}

.dialog-wrapper :deep(dialog) {
  pointer-events: auto;
}

/* 添加菜单动画 */
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

.menu-enter-active {
  animation: menu-in 0.2s ease-out;
}

.menu-leave-active {
  animation: menu-out 0.2s ease-in;
}
</style>
