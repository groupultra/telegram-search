<script setup lang="ts">
import { useAccountStore, useSessionStore } from '@tg-search/client'
import { useDark } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import EntityAvatar from '../avatar/EntityAvatar.vue'
import ChatListSection from './ChatListSection.vue'
import LanguageSelector from './LanguageSelector.vue'
import SidebarSelector from './SidebarSelector.vue'
import UserDropdown from './UserDropdown.vue'

import { Button } from '../ui/Button'

const { t } = useI18n()
const accountStore = useAccountStore()
const { activeSession } = storeToRefs(useSessionStore())
const isDark = useDark()

const searchParams = ref('')
const userDropdownOpen = ref(false)
</script>

<template>
  <div class="h-full flex flex-col bg-card">
    <!-- Search section -->
    <div class="border-b p-3">
      <div class="relative">
        <div
          class="i-lucide-search absolute left-3 top-1/2 h-4 w-4 text-muted-foreground -translate-y-1/2"
        />
        <input
          v-model="searchParams"
          type="text"
          class="h-9 w-full border rounded-md bg-background px-3 py-1 pl-9 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          :placeholder="t('search.search')"
        >
      </div>
    </div>

    <!-- Navigation -->
    <div class="py-2">
      <SidebarSelector
        path="/sync"
        icon="i-lucide-refresh-cw"
        :name="t('sync.sync')"
      />

      <SidebarSelector
        path="/search"
        icon="i-lucide-search"
        :name="t('search.search')"
      />

      <SidebarSelector
        path="/ai-chat"
        icon="i-lucide-message-square-text"
        :name="t('aiChat.aiChat')"
      />

      <SidebarSelector
        path="/settings"
        icon="i-lucide-settings"
        :name="t('settings.settings')"
      />
    </div>

    <!-- Chat groups and list -->
    <ChatListSection :search-query="searchParams" />

    <!-- User profile section -->
    <div class="relative border-t p-3">
      <div class="flex items-center justify-between gap-2">
        <div
          class="min-w-0 flex flex-1 cursor-pointer items-center gap-2.5 rounded-md p-1 transition-colors hover:bg-accent"
          @click="userDropdownOpen = !userDropdownOpen"
        >
          <div class="h-8 w-8 flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
            <EntityAvatar
              v-if="activeSession?.me?.id != null"
              :id="activeSession?.me?.id!"
              entity="self"
              entity-type="user"
              :name="activeSession?.me?.name"
              size="sm"
            />
          </div>
          <div class="min-w-0 flex flex-1 flex-col">
            <span class="truncate text-sm font-medium">{{ activeSession?.me?.name }}</span>
            <span class="truncate text-xs text-muted-foreground">{{ accountStore.isReady ? t('settings.connected') : t('settings.disconnected') }}</span>
          </div>
          <div class="i-lucide-chevron-up h-4 w-4 shrink-0 text-muted-foreground" />
        </div>

        <!-- Control buttons -->
        <div class="flex shrink-0 items-center gap-1">
          <Button
            :icon="isDark ? 'i-lucide-sun' : 'i-lucide-moon'"
            class="h-8 w-8 rounded-md p-0"
            variant="ghost"
            size="sm"
            :title="isDark ? t('settings.switchToLightMode') : t('settings.switchToDarkMode')"
            @click="() => { isDark = !isDark }"
          />

          <LanguageSelector />
        </div>
      </div>

      <!-- User dropdown menu -->
      <UserDropdown v-model:open="userDropdownOpen" />
    </div>
  </div>
</template>
