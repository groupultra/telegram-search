<script lang="ts" setup>
import { useAuthStore } from '@tg-search/client'
import { onClickOutside } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'

import Avatar from '../ui/Avatar.vue'

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
    class="absolute left-0 top-full z-10 mt-2 min-w-[200px] border rounded-md bg-popover p-2 shadow-lg"
  >
    <div class="flex items-center gap-3 border-b p-3">
      <Avatar
        :name="username"
        size="md"
      />
      <div class="flex flex-col">
        <span class="text-sm text-primary-900 font-medium">{{ username }}</span>
        <span class="text-xs text-complementary-600">ID: {{ userId }}</span>
      </div>
    </div>

    <div class="mt-2">
      <button
        class="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-primary-900 hover:bg-neutral-100"
        @click="handleLoginLogout"
      >
        <div :class="isLoggedIn ? 'i-lucide-log-out' : 'i-lucide-log-in'" class="h-4 w-4" />
        {{ isLoggedIn ? '退出登录' : '登录' }}
      </button>
    </div>
  </div>
</template>
