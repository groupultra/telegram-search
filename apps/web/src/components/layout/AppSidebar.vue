<script setup lang="ts">
import { useSessionStore } from '@tg-search/client'
import { useDark } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import EntityAvatar from '../avatar/EntityAvatar.vue'
import ChatListSection from './ChatListSection.vue'
import LanguageSelector from './LanguageSelector.vue'
import SidebarSelector from './SidebarSelector.vue'
import UserDropdown from './UserDropdown.vue'

import { SIDEBAR_NAV_ITEMS } from '../../constants'
import { runThemeAppearanceTransition } from '../../lib/utils'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

const { t } = useI18n()
const { activeSession } = storeToRefs(useSessionStore())
const isDark = useDark()

const searchParams = ref('')
const navigationItems = computed(() => {
  return SIDEBAR_NAV_ITEMS.map(item => ({
    ...item,
    label: t(item.labelKey),
  }))
})

function toggleTheme(event: Event) {
  void runThemeAppearanceTransition(event, async () => {
    isDark.value = !isDark.value
    await nextTick()
  })
}
</script>

<template>
  <div class="h-full flex flex-col bg-card/50 backdrop-blur-xl">
    <!-- Search section -->
    <div class="px-4 pb-2 pt-4">
      <div class="group relative">
        <div
          class="i-lucide-search absolute left-3 top-1/2 h-4 w-4 text-muted-foreground transition-colors -translate-y-1/2 group-focus-within:text-primary"
        />
        <Input
          v-model="searchParams"
          type="text"
          class="h-10 border-border/60 rounded-xl bg-background/80 pl-9 text-foreground shadow-sm transition-all focus:border-primary/35 hover:border-border focus:bg-background hover:bg-background placeholder:text-foreground/45 focus:ring-2 focus:ring-primary/15"
          :placeholder="t('search.search')"
        />
      </div>
    </div>

    <!-- Navigation -->
    <div class="flex-col gap-0.5 px-3 py-2 hidden md:flex">
      <SidebarSelector
        v-for="item in navigationItems"
        :key="item.path"
        :path="item.path"
        :icon="item.icon"
        :name="item.label"
      />
    </div>

    <!-- Chat groups and list -->
    <ChatListSection :search-query="searchParams" />

    <!-- User profile section -->
    <div class="mt-auto border-t border-border/40 bg-muted/30 p-3 backdrop-blur-sm">
      <div class="flex items-center justify-between gap-2">
        <!-- User dropdown menu -->
        <UserDropdown class="min-w-0 flex-1">
          <div
            class="group min-w-0 w-full flex cursor-pointer items-center gap-3 rounded-xl p-2 transition-all hover:bg-background hover:shadow-sm"
          >
            <EntityAvatar
              v-if="activeSession?.me?.id != null"
              :id="activeSession?.me?.id"
              entity="self"
              entity-type="user"
              :name="activeSession?.me?.name"
              size="sm"
              class="shrink-0 ring-2 ring-transparent transition-all group-hover:ring-primary/20"
            />
            <div v-else class="h-8 w-8 flex shrink-0 items-center justify-center rounded-full bg-muted group-hover:bg-primary/10 group-hover:text-primary">
              <span class="i-lucide-user h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
            </div>

            <div class="flex flex-1 flex-col overflow-hidden">
              <span class="truncate text-sm text-foreground/80 font-semibold group-hover:text-foreground">{{ activeSession?.me?.name || t('settings.notLoggedIn') }}</span>
              <span v-if="activeSession?.me?.id" class="truncate text-xs text-muted-foreground group-hover:text-muted-foreground/80">ID: {{ activeSession?.me?.id }}</span>
            </div>
            <div class="i-lucide-chevrons-up-down h-3 w-3 shrink-0 text-muted-foreground opacity-50 transition-opacity group-hover:opacity-100" />
          </div>
        </UserDropdown>

        <!-- Control buttons -->
        <div class="flex shrink-0 flex-row gap-1">
          <Button
            :icon="isDark ? 'i-lucide-sun' : 'i-lucide-moon'"
            class="h-8 w-8 rounded-lg text-muted-foreground hover:bg-background hover:text-foreground hover:shadow-sm"
            variant="ghost"
            size="icon"
            :title="isDark ? t('settings.switchToLightMode') : t('settings.switchToDarkMode')"
            @click="toggleTheme"
          />

          <LanguageSelector />
        </div>
      </div>
    </div>
  </div>
</template>
