<script setup lang="ts">
import { useAuthStore, useBridgeStore, useSettingsStore } from '@tg-search/client'
import { useDark } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from 'radix-vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import Avatar from './ui/Avatar.vue'
import SettingsSwitch from './ui/Switch/SettingsSwitch.vue'

const { t } = useI18n()
const websocketStore = useBridgeStore()
const authStore = useAuthStore()
const { isLoggedIn } = storeToRefs(authStore)
const { logout } = authStore.handleAuth()

const settingsStore = useSettingsStore()
const { useCachedMessage, debugMode, language } = storeToRefs(settingsStore)

const isDark = useDark()
const isOpen = ref(false)

const languageOptions = computed(() => [
  { label: t('settings.chinese'), value: 'zhCN' },
  { label: t('settings.english'), value: 'en' },
])

const router = useRouter()

function handleLogin() {
  router.push('/login')
  isOpen.value = false
}

function handleLogout() {
  logout()
  isOpen.value = false
}
</script>

<template>
  <DropdownMenuRoot v-model:open="isOpen">
    <DropdownMenuTrigger as-child>
      <button class="i-lucide-menu hidden h-5 w-5 text-muted-foreground hover:text-foreground md:block" />
    </DropdownMenuTrigger>

    <DropdownMenuPortal>
      <DropdownMenuContent class="min-w-[200px] rounded-md border border-border bg-card p-2 text-card-foreground shadow-lg">
        <template v-if="isLoggedIn">
          <div class="mb-2 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <Avatar :name="websocketStore.getActiveSession()?.me?.name" size="xs" />
              <span class="text-sm text-foreground">{{ websocketStore.getActiveSession()?.me?.name }}</span>
            </div>
            <span class="text-xs text-muted-foreground">ID: {{ websocketStore.getActiveSession()?.me?.id }}</span>
          </div>

          <DropdownMenuSeparator class="my-2 h-px bg-border" />
        </template>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger class="flex cursor-pointer items-center justify-between gap-2 rounded py-1.5 outline-none transition-colors data-[highlighted]:bg-muted data-[state=open]:bg-muted">
            <div class="flex items-center gap-2">
              <div class="i-lucide-earth text-foreground" />
              <span class="text-xs text-foreground">{{ t('settings.language') }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-foreground">{{ languageOptions.find(opt => opt.value === language)?.label }}</span>
              <div class="i-lucide-chevron-right text-muted-foreground" />
            </div>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent
              class="min-w-[120px] rounded-md border border-border bg-card p-1 text-card-foreground shadow-lg"
              :side-offset="2"
              :align-offset="-5"
            >
              <DropdownMenuItem
                v-for="option in languageOptions"
                :key="option.value"
                class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 outline-none transition-colors data-[highlighted]:bg-muted"
                @click="language = option.value"
              >
                <span class="text-xs text-foreground">{{ option.label }}</span>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        <div class="flex items-center justify-between gap-2 rounded py-1.5 transition-colors hover:bg-muted">
          <div class="flex items-center gap-2">
            <div class="i-lucide-moon text-foreground" />
            <span class="text-xs text-foreground">{{ t('settings.darkMode') }}</span>
          </div>
          <SettingsSwitch v-model="isDark" size="sm" />
        </div>

        <div class="flex items-center justify-between gap-2 rounded py-1.5 transition-colors hover:bg-muted">
          <div class="flex items-center gap-2">
            <div class="i-lucide-bug text-foreground" />
            <span class="text-xs text-foreground">{{ t('settings.debugMode') }}</span>
          </div>
          <SettingsSwitch v-model="debugMode" size="sm" />
        </div>

        <div class="flex items-center justify-between gap-2 rounded py-1.5 transition-colors hover:bg-muted">
          <div class="flex items-center gap-2">
            <div class="i-lucide-database text-foreground" />
            <span class="text-xs text-foreground">{{ t('settings.useCachedMessage') }}</span>
          </div>
          <SettingsSwitch v-model="useCachedMessage" size="sm" />
        </div>

        <DropdownMenuSeparator class="my-2 h-px bg-border" />

        <template v-if="!isLoggedIn">
          <DropdownMenuItem
            class="flex cursor-pointer items-center gap-2 rounded py-1.5 outline-none transition-colors data-[highlighted]:bg-muted"
            @click="handleLogin"
          >
            <div class="i-lucide-log-in text-foreground" />
            <span class="text-xs text-foreground">{{ t('settings.login') }}</span>
          </DropdownMenuItem>
        </template>
        <template v-else>
          <DropdownMenuItem
            class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 outline-none transition-colors data-[highlighted]:bg-muted"
            @click="handleLogout"
          >
            <div class="i-lucide-log-out text-foreground" />
            <span class="text-xs text-foreground">{{ t('settings.logout') }}</span>
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
