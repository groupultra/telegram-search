<script setup lang="ts">
import { useAuthStore, useSettingsStore } from '@tg-search/client'
import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import Dialog from '../ui/Dialog.vue'
import SelectDropdown from '../ui/SelectDropdown.vue'
import { Switch } from '../ui/Switch'

const { t } = useI18n()
const { locale } = useI18n()

const router = useRouter()
const showDialog = defineModel<boolean>('showDialog', { required: true })

const sessionStore = useAuthStore()
const { isLoggedIn } = storeToRefs(sessionStore)
const { logout } = sessionStore.handleAuth()

const settingsStore = useSettingsStore()
const { useCachedMessage, debugMode, language } = storeToRefs(settingsStore)

// Language options
const languageOptions = computed(() => [
  { label: t('settings.chinese'), value: 'zhCN' },
  { label: t('settings.english'), value: 'en' },
])

// Sync language with i18n locale
watch(language, (newValue: string) => {
  locale.value = newValue
}, { immediate: true })

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
        <div class="i-lucide-settings h-5 w-5 text-gray-900 dark:text-gray-100" />
        <span class="text-lg text-gray-900 font-medium dark:text-gray-100">{{ t('settings.settings') }}</span>
      </div>
      <button class="rounded-md p-1 text-gray-900 transition-colors hover:bg-neutral-100/50 dark:text-gray-100 dark:hover:bg-gray-700/50" @click="showDialog = false">
        <div class="i-lucide-x h-5 w-5" />
      </button>
    </div>
    <div class="space-y-4">
      <!-- Language Selection -->
      <div class="flex items-center justify-between rounded-lg p-3 text-gray-900 transition-colors hover:bg-neutral-100/50 dark:text-gray-100 dark:hover:bg-gray-700/50">
        <div class="flex items-center gap-2">
          <div class="i-lucide-globe h-5 w-5" />
          <span>{{ t('settings.language') }}</span>
        </div>
        <SelectDropdown
          v-model="language"
          :options="languageOptions"
          class="min-w-[120px]"
        />
      </div>

      <template v-if="!isLoggedIn">
        <div class="flex items-center justify-between rounded-lg p-3 text-gray-900 transition-colors hover:bg-neutral-100/50 dark:text-gray-100 dark:hover:bg-gray-700/50">
          <div class="flex items-center gap-2">
            <div class="i-lucide-log-in h-5 w-5" />
            <span>{{ t('settings.login') }}</span>
          </div>
          <button class="text-primary transition-colors hover:text-primary/80" @click="handleLogin">
            {{ t('settings.login') }}
          </button>
        </div>
      </template>
      <template v-else>
        <div class="flex items-center justify-between rounded-lg p-3 text-gray-900 transition-colors hover:bg-neutral-100/50 dark:text-gray-100 dark:hover:bg-gray-700/50">
          <div class="flex items-center gap-2">
            <div class="i-lucide-log-out h-5 w-5" />
            <span>{{ t('settings.logout') }}</span>
          </div>
          <button class="text-primary transition-colors hover:text-primary/80" @click="handleLogout">
            {{ t('settings.logout') }}
          </button>
        </div>
      </template>

      <div class="flex items-center justify-between rounded-lg p-3 text-gray-900 transition-colors hover:bg-neutral-100/50 dark:text-gray-100 dark:hover:bg-gray-700/50">
        <div class="flex items-center gap-2">
          <div class="i-lucide-database h-5 w-5" />
          <span>{{ t('settings.debugMode') }}</span>
        </div>
        <Switch
          v-model="debugMode"
          class="text-primary transition-colors hover:text-primary/80"
        >
          {{ debugMode ? t('settings.open') : t('settings.close') }}
        </Switch>
      </div>

      <div class="flex items-center justify-between rounded-lg p-3 text-gray-900 transition-colors hover:bg-neutral-100/50 dark:text-gray-100 dark:hover:bg-gray-700/50">
        <div class="flex items-center gap-2">
          <div class="i-lucide-database h-5 w-5" />
          <span>{{ t('settings.useCachedMessage') }}</span>
        </div>
        <Switch
          v-model="useCachedMessage"
          class="text-primary transition-colors hover:text-primary/80"
        >
          {{ useCachedMessage ? t('settings.open') : t('settings.close') }}
        </Switch>
      </div>
    </div>
  </Dialog>
</template>
