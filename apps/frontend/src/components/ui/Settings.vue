<script setup lang="ts">
import { useDark, useToggle } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useSessionStore } from '../../store/useSessionV2'

const emit = defineEmits<{
  (e: 'toggleSettingsDialogEmit'): void
}>()

const router = useRouter()

const sessionStore = useSessionStore()
const { logout } = sessionStore.handleAuth()
const isDark = useDark()
const toggleDark = useToggle(isDark)

function toggleSettingsDialog() {
  emit('toggleSettingsDialogEmit')
}

function settingLogout() {
  logout()
  router.push('/login')
}
</script>

<template>
  <div class="p-6">
    <div class="mb-6 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="i-lucide-settings h-5 w-5" />
        <span class="text-lg font-medium">设置</span>
      </div>
      <button class="rounded-md p-1 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700" @click="toggleSettingsDialog">
        <div class="i-lucide-x h-5 w-5" />
      </button>
    </div>
    <div class="space-y-4">
      <div class="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700">
        <div class="flex items-center gap-2">
          <div class="i-lucide-moon h-5 w-5" />
          <span>深色模式</span>
        </div>
        <Switch :model-value="isDark" @update:model-value="toggleDark" />
      </div>
      <div class="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700">
        <div class="flex items-center gap-2">
          <div class="i-lucide-globe h-5 w-5" />
          <span>语言</span>
        </div>
        <button class="transition-colors">
          None
        </button>
      </div>
      <div class="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700">
        <div class="flex items-center gap-2">
          <div class="i-lucide-log-out h-5 w-5" />
          <span>退出登录</span>
        </div>
        <button class="text-red-500 transition-colors hover:text-red-600" @click="settingLogout">
          退出
        </button>
      </div>
    </div>
  </div>
</template>
