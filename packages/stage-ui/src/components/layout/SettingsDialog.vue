<script setup lang="ts">
import { useAuthStore, useSettingsStore } from '@tg-search/client'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'

import Dialog from '../ui/Dialog.vue'
import { Switch } from '../ui/Switch'

const router = useRouter()
const showDialog = defineModel<boolean>('showDialog', { required: true })

const sessionStore = useAuthStore()
const { isLoggedIn } = storeToRefs(sessionStore)
const { logout } = sessionStore.handleAuth()

const settingsStore = useSettingsStore()
const { messageDebugMode } = storeToRefs(settingsStore)

function handleLogout() {
  logout()
}

function handleLogin() {
  router.push('/login')
}
</script>

<template>
  <Dialog v-model="showDialog">
    <div class="mb-6 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="i-lucide-settings h-5 w-5 text-primary-900" />
        <span class="text-lg text-primary-900 font-medium">设置</span>
      </div>
      <button class="rounded-md p-1 text-primary-900 transition-colors hover:bg-neutral-100/50" @click="showDialog = false">
        <div class="i-lucide-x h-5 w-5" />
      </button>
    </div>
    <div class="space-y-4">
      <template v-if="!isLoggedIn">
        <div class="flex items-center justify-between rounded-lg p-3 text-primary-900 transition-colors hover:bg-neutral-100/50">
          <div class="flex items-center gap-2">
            <div class="i-lucide-log-in h-5 w-5" />
            <span>登录</span>
          </div>
          <button class="text-primary transition-colors hover:text-primary/80" @click="handleLogin">
            登录
          </button>
        </div>
      </template>
      <template v-else>
        <div class="flex items-center justify-between rounded-lg p-3 text-primary-900 transition-colors hover:bg-neutral-100/50">
          <div class="flex items-center gap-2">
            <div class="i-lucide-log-out h-5 w-5" />
            <span>退出登录</span>
          </div>
          <button class="text-primary transition-colors hover:text-primary/80" @click="handleLogout">
            退出
          </button>
        </div>
      </template>

      <div class="flex items-center justify-between rounded-lg p-3 text-primary-900 transition-colors hover:bg-neutral-100/50">
        <div class="flex items-center gap-2">
          <div class="i-lucide-database h-5 w-5" />
          <span>不使用数据库拉取信息 (仅用于调试)</span>
        </div>
        <Switch
          v-model="messageDebugMode"
          class="text-primary transition-colors hover:text-primary/80"
        >
          {{ messageDebugMode ? '开启' : '关闭' }}
        </Switch>
      </div>
    </div>
  </Dialog>
</template>
