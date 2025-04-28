<script setup lang="ts">
import { useDark, useToggle } from '@vueuse/core'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '../../store/useSession'

const emit = defineEmits<{
  (e: 'toggleSettingsDialogEmit'): void
  (e: 'setThemeEmit', theme: string): void
}>()

const router = useRouter()

// 主题相关
const themes = [
  { name: '默认', value: 'default' },
  { name: '莫奈', value: 'monet' },
  { name: '橙色', value: 'orange' },
  { name: '绿色', value: 'green' },
  { name: '淡蓝', value: 'light-blue' },
]

const currentTheme = ref(localStorage.getItem('theme') || 'default')

function handleThemeChange(theme: string) {
  currentTheme.value = theme
  emit('setThemeEmit', theme)
}

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
        <div class="i-lucide-settings h-5 w-5 text-foreground" />
        <span class="text-lg text-foreground font-medium">设置</span>
      </div>
      <button class="rounded-md p-1 text-foreground transition-colors hover:bg-popover/50" @click="toggleSettingsDialog">
        <div class="i-lucide-x h-5 w-5" />
      </button>
    </div>
    <div class="space-y-4">
      <div class="flex items-center justify-between rounded-lg p-3 text-foreground transition-colors hover:bg-popover/50">
        <div class="flex items-center gap-2">
          <div class="i-lucide-moon h-5 w-5" />
          <span>深色模式</span>
        </div>
        <Switch :model-value="isDark" @update:model-value="toggleDark" />
      </div>
      <div class="flex items-center justify-between rounded-lg p-3 text-foreground transition-colors hover:bg-popover/50">
        <div class="flex items-center gap-2">
          <div class="i-lucide-palette h-5 w-5" />
          <span>主题</span>
        </div>
        <select
          v-model="currentTheme"
          class="border-input focus-visible:ring-ring h-9 w-[180px] border rounded-md bg-background px-3 py-1 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          @change="(e) => handleThemeChange((e.target as HTMLSelectElement).value)"
        >
          <option v-for="theme in themes" :key="theme.value" :value="theme.value">
            {{ theme.name }}
          </option>
        </select>
      </div>
      <div class="flex items-center justify-between rounded-lg p-3 text-foreground transition-colors hover:bg-popover/50">
        <div class="flex items-center gap-2">
          <div class="i-lucide-globe h-5 w-5" />
          <span>语言</span>
        </div>
        <button class="transition-colors">
          None
        </button>
      </div>
      <div class="flex items-center justify-between rounded-lg p-3 text-foreground transition-colors hover:bg-popover/50">
        <div class="flex items-center gap-2">
          <div class="i-lucide-log-out h-5 w-5" />
          <span>退出登录</span>
        </div>
        <button class="text-primary transition-colors hover:text-primary/80" @click="settingLogout">
          退出
        </button>
      </div>
    </div>
  </div>
</template>
