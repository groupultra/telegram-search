<script lang="ts" setup>
import { useAuthStore, useBridgeStore } from '@tg-search/client'
import { onClickOutside } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import EntityAvatar from '../avatar/EntityAvatar.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const authStore = useAuthStore()
const { isLoggedIn, activeSessionComputed } = storeToRefs(authStore)
const { activeSessionId } = storeToRefs(useBridgeStore())

const isOpen = defineModel<boolean>('open')

const dropdownRef = useTemplateRef<HTMLElement>('dropdown')

onClickOutside(dropdownRef, () => {
  isOpen.value = false
})

function handleLoginLogout() {
  if (isLoggedIn.value) {
    authStore.handleAuth().logout()
  }
  else {
    router.push({
      path: '/login',
      query: { redirect: route.fullPath },
    })
  }
}

function handleAddAccount() {
  isOpen.value = false
  authStore.handleAuth().addNewAccount()
  router.push({
    path: '/login',
    query: { redirect: route.fullPath },
  })
}

function handleSwitchAccount(sessionId: string) {
  authStore.handleAuth().switchAccount(sessionId)
  isOpen.value = false
}

function handleLogoutCurrentAccount() {
  authStore.handleAuth().logout()
  isOpen.value = false
}

const username = computed(() => activeSessionComputed.value?.me?.username)
const userId = computed(() => activeSessionComputed.value?.me?.id)
const allAccounts = computed(() => authStore.handleAuth().getAllAccounts())
const otherAccounts = computed(() => {
  return allAccounts.value.filter(account => account.uuid !== activeSessionId.value)
})
</script>

<template>
  <div
    v-if="isOpen"
    ref="dropdownRef"
    class="fixed bottom-16 left-2 z-1000 min-w-[240px] border border-border rounded-md bg-popover p-2 shadow-lg dark:border-gray-600 dark:bg-gray-800"
  >
    <!-- Current Account Section -->
    <div v-if="isLoggedIn" class="border-b pb-2 dark:border-gray-600">
      <div class="px-2 py-1 text-xs text-muted-foreground font-semibold">
        {{ t('settings.currentAccount') }}
      </div>
      <div class="flex items-center gap-3 p-2">
        <EntityAvatar
          v-if="userId != null"
          :id="userId"
          entity="self"
          entity-type="user"
          :name="username"
          size="md"
        />
        <div class="flex flex-1 flex-col overflow-hidden">
          <span class="truncate text-sm text-gray-900 font-medium dark:text-gray-100">{{ username }}</span>
          <span class="truncate text-xs text-gray-600 dark:text-gray-400">ID: {{ userId }}</span>
        </div>
      </div>
    </div>

    <!-- Switch Account Section -->
    <div v-if="otherAccounts.length > 0" class="border-b py-2 dark:border-gray-600">
      <div class="px-2 py-1 text-xs text-muted-foreground font-semibold">
        {{ t('settings.switchAccount') }}
      </div>
      <div class="space-y-1">
        <button
          v-for="account in otherAccounts"
          :key="account.uuid"
          class="w-full flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-neutral-100 dark:hover:bg-gray-700"
          @click="handleSwitchAccount(account.uuid)"
        >
          <EntityAvatar
            v-if="account.metadata.me?.id"
            :id="account.metadata.me.id"
            entity="self"
            entity-type="user"
            :name="account.metadata.me?.username"
            size="sm"
          />
          <div class="flex flex-1 flex-col overflow-hidden">
            <span class="truncate text-sm text-gray-900 font-medium dark:text-gray-100">
              {{ account.metadata.me?.username || (account.metadata.me?.id ? `ID: ${account.metadata.me.id}` : t('settings.notLoggedIn')) }}
            </span>
            <span v-if="account.metadata.me?.id" class="truncate text-xs text-gray-600 dark:text-gray-400">
              ID: {{ account.metadata.me.id }}
            </span>
          </div>
        </button>
      </div>
    </div>

    <!-- Actions Section -->
    <div class="mt-2 space-y-1">
      <!-- Only show Add Account when there is at least one existing account -->
      <button
        v-if="allAccounts.length > 0"
        class="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-900 hover:bg-neutral-100 dark:text-gray-100 dark:hover:bg-gray-700"
        @click="handleAddAccount"
      >
        <div class="i-lucide-user-plus h-4 w-4" />
        {{ t('settings.addAccount') }}
      </button>

      <button
        class="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
        @click="handleLogoutCurrentAccount"
      >
        <div class="i-lucide-log-out h-4 w-4" />
        {{ t('settings.logoutCurrentAccount') }}
      </button>

      <!-- First-time / no accounts: only show Login -->
      <button
        v-if="allAccounts.length === 0"
        class="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-900 hover:bg-neutral-100 dark:text-gray-100 dark:hover:bg-gray-700"
        @click="handleLoginLogout"
      >
        <div class="i-lucide-log-in h-4 w-4" />
        {{ t('settings.login') }}
      </button>
    </div>
  </div>
</template>
