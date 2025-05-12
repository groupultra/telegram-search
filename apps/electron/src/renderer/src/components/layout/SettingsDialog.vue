<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'

import { useSessionStore } from '../../store/useSession'
import { useSettingsStore } from '../../store/useSettings'
import Dialog from '../ui/Dialog.vue'

const router = useRouter()
const showDialog = defineModel<boolean>('showDialog', { required: true })

const settingsStore = useSettingsStore()
const { theme: selectedTheme, themesOptions } = storeToRefs(settingsStore)

const sessionStore = useSessionStore()
const { logout } = sessionStore.handleAuth()

function handleLogout() {
  logout()
  router.push('/login')
}
</script>

<template>
  <Dialog v-model="showDialog">
    <div class="mb-6 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="i-lucide-settings h-5 w-5 text-foreground" />
        <span class="text-lg text-foreground font-medium">设置</span>
      </div>
      <button class="rounded-md p-1 text-foreground transition-colors hover:bg-popover/50" @click="showDialog = false">
        <div class="i-lucide-x h-5 w-5" />
      </button>
    </div>
    <div class="space-y-4">
      <div class="flex items-center justify-between rounded-lg p-3 text-foreground transition-colors hover:bg-popover/50">
        <div class="flex items-center gap-2">
          <div class="i-lucide-palette h-5 w-5" />
          <span>主题</span>
        </div>
        <select
          v-model="selectedTheme"
          class="border-input focus-visible:ring-ring h-9 w-[180px] border rounded-md bg-background px-3 py-1 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          <option v-for="theme in themesOptions" :key="theme.value" :value="theme.value">
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
        <button class="text-primary transition-colors hover:text-primary/80" @click="handleLogout">
          退出
        </button>
      </div>
    </div>
  </Dialog>
</template>
