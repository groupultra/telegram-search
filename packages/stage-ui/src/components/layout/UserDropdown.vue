<script lang="ts" setup>
import { useAuthStore } from '@tg-search/client'
import { onClickOutside } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import Avatar from '../ui/Avatar.vue'

const { t } = useI18n()

const authStore = useAuthStore()
const { isLoggedIn, activeSessionComputed } = storeToRefs(authStore)

const isOpen = defineModel<boolean>('open')

const dropdownRef = useTemplateRef<HTMLElement>('dropdown')

onClickOutside(dropdownRef, () => {
  isOpen.value = false
})

function handleLoginLogout() {
  if (isLoggedIn.value)
    authStore.handleAuth().logout()
  else
    useRouter().push('/login')
}

const username = computed(() => activeSessionComputed.value?.me?.username)
const userId = computed(() => activeSessionComputed.value?.me?.id)
</script>

<template>
  <div
    v-if="isOpen"
    ref="dropdownRef"
    class="absolute left-0 top-full z-10 mt-2 min-w-[200px] border border-border rounded-md bg-popover p-2 shadow-lg dark:border-gray-600 dark:bg-gray-800"
  >
    <div class="flex items-center gap-3 border-b p-3 dark:border-gray-600">
      <Avatar
        :name="username"
        size="md"
      />
      <div class="flex flex-col">
        <span class="text-sm text-gray-900 font-medium dark:text-gray-100">{{ username }}</span>
        <span class="text-xs text-gray-600 dark:text-gray-400">ID: {{ userId }}</span>
      </div>
    </div>

    <div class="mt-2">
      <button
        class="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-900 hover:bg-neutral-100 dark:text-gray-100 dark:hover:bg-gray-700"
        @click="handleLoginLogout"
      >
        <div :class="isLoggedIn ? 'i-lucide-log-out' : 'i-lucide-log-in'" class="h-4 w-4" />
        {{ isLoggedIn ? t('settings.logout') : t('settings.login') }}
      </button>
    </div>
  </div>
</template>
