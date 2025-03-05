<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { useAuth } from '../apis/useAuth'
import { useDarkStore } from '../composables/dark'
import { useSession } from '../composables/useSession'

const router = useRouter()
const { logout } = useAuth()
const { isDark } = useDarkStore()
const { checkConnection, isConnected } = useSession()
const showUserMenu = ref(false)
const userMenuRef = ref<HTMLElement | null>(null)

// Use VueUse's onClickOutside to handle closing the menu
onClickOutside(userMenuRef, () => {
  showUserMenu.value = false
})

// 检查用户是否已登录
onMounted(async () => {
  await checkConnection(false)
})

// 处理注销
async function handleLogout() {
  showUserMenu.value = false
  const success = await logout()
  if (success) {
    toast.success('已成功登出 Telegram')
    router.push('/login')
  }
  else {
    toast.error('登出失败，请重试')
  }
}

// 处理登录
async function handleLogin() {
  showUserMenu.value = false
  router.push('/login')
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
          <ThemeToggle />

          <IconButton
            icon="i-carbon-mac-command"
            aria-label="{{$t('header.commands')}}"
            @click="router.push('/commands')"
          />

          <IconButton
            icon="i-carbon-settings"
            with-transition
            aria-label="{{$t('header.setting')}}"
            @click="router.push('/settings')"
          />

          <!-- 用户头像与下拉菜单 -->
          <div ref="userMenuRef" class="relative">
            <IconButton
              icon="i-carbon-user"
              size="md"
              custom-class="rounded-full"
              aria-label="{{ $t('header.usermenu') }}"
              @click="showUserMenu = !showUserMenu"
            />

            <!-- 用户菜单 -->
            <div
              v-if="showUserMenu"
              class="absolute right-0 z-50 mt-2 w-48 border border-gray-200 rounded-md bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
            >
              <button
                v-if="!isConnected"
                class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                @click="handleLogin"
              >
                <div class="flex items-center">
                  <div class="i-carbon-login mr-2 h-4 w-4" />
                  <span>{{ $t('header.login') }}</span>
                </div>
              </button>

              <button
                v-if="isConnected"
                class="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                @click="handleLogout"
              >
                <div class="flex items-center">
                  <div class="i-carbon-logout mr-2 h-4 w-4" />
                  <span>{{ $t('header.logout') }}</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- Main content -->
    <main class="mx-auto bg-white transition-colors duration-300 container dark:bg-gray-900">
      <slot />
    </main>
  </div>
</template>
