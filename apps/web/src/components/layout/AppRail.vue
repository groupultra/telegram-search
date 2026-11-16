<script setup lang="ts">
import { useSessionStore } from '@tg-search/client'
import { storeToRefs } from 'pinia'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import AppearancePicker from '../appearance/AppearancePicker.vue'
import EntityAvatar from '../avatar/EntityAvatar.vue'
import LanguagePicker from './LanguagePicker.vue'
import UserDropdown from './UserDropdown.vue'

import { useChatPanel } from '../../composables/use-chat-panel'
import { NAV_ICON_CLASS, SIDEBAR_NAV_ITEMS } from '../../constants'

const emit = defineEmits<{
  openSearch: []
}>()

const { t } = useI18n()
const route = useRoute()
const { activeSession } = storeToRefs(useSessionStore())
const { isOpen: isChatPanelOpen, toggle: toggleChatPanel } = useChatPanel()

const navigationItems = computed(() => {
  return SIDEBAR_NAV_ITEMS.map(item => ({
    ...item,
    label: t(item.labelKey),
  }))
})

const RAIL_BUTTON_CLASS = 'relative h-9 w-9 flex items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/6 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const RAIL_BUTTON_ACTIVE_CLASS = 'bg-foreground/8 text-foreground!'
</script>

<template>
  <nav class="h-full w-14 flex shrink-0 flex-col items-center gap-1 border-r bg-sidebar py-3">
    <!-- Brand mark -->
    <RouterLink
      to="/"
      class="mb-2 h-8 w-8 flex items-center justify-center rounded-lg bg-primary text-primary-foreground"
      aria-label="Telegram Search"
    >
      <span class="i-lucide-search h-4 w-4" />
    </RouterLink>

    <button
      type="button"
      :class="RAIL_BUTTON_CLASS"
      :title="`${t('layout.searchEverything')} (⌘K)`"
      :aria-label="t('layout.searchEverything')"
      @click="emit('openSearch')"
    >
      <span class="i-lucide-command h-4.5 w-4.5" />
    </button>

    <button
      type="button"
      :class="[RAIL_BUTTON_CLASS, isChatPanelOpen ? RAIL_BUTTON_ACTIVE_CLASS : '']"
      :title="isChatPanelOpen ? t('layout.hideChatList') : t('layout.showChatList')"
      :aria-label="isChatPanelOpen ? t('layout.hideChatList') : t('layout.showChatList')"
      :aria-pressed="isChatPanelOpen"
      @click="toggleChatPanel"
    >
      <span class="i-lucide-messages-square h-4.5 w-4.5" />
    </button>

    <div class="my-1 h-px w-6 bg-border" />

    <RouterLink
      v-for="item in navigationItems"
      :key="item.path"
      :to="item.path"
      :class="[RAIL_BUTTON_CLASS, route.path === item.path ? RAIL_BUTTON_ACTIVE_CLASS : '']"
      :title="item.label"
      :aria-label="item.label"
      :aria-current="route.path === item.path ? 'page' : undefined"
    >
      <span :class="NAV_ICON_CLASS[item.icon]" class="h-4.5 w-4.5" />
      <span
        v-if="route.path === item.path"
        class="absolute left-0 top-1/2 h-4 w-0.5 rounded-r-full bg-primary -translate-x-2.5 -translate-y-1/2"
      />
    </RouterLink>

    <div class="mt-auto flex flex-col items-center gap-1">
      <PopoverRoot>
        <PopoverTrigger as-child>
          <button
            type="button"
            :class="RAIL_BUTTON_CLASS"
            :title="t('appearance.title')"
            :aria-label="t('appearance.title')"
          >
            <span class="i-lucide-palette h-4.5 w-4.5" />
          </button>
        </PopoverTrigger>
        <PopoverPortal>
          <PopoverContent
            side="right"
            align="end"
            :side-offset="12"
            class="z-50 w-72 flex flex-col gap-4 border rounded-xl bg-popover p-4 text-popover-foreground shadow-lg outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:slide-in-from-left-2"
          >
            <AppearancePicker />
            <div class="h-px bg-border" />
            <LanguagePicker />
          </PopoverContent>
        </PopoverPortal>
      </PopoverRoot>

      <UserDropdown>
        <button
          type="button"
          class="mt-1 h-9 w-9 flex items-center justify-center rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          :title="activeSession?.me?.name || t('settings.notLoggedIn')"
          :aria-label="activeSession?.me?.name || t('settings.notLoggedIn')"
        >
          <EntityAvatar
            v-if="activeSession?.me?.id != null"
            :id="activeSession.me.id"
            entity="self"
            entity-type="user"
            :name="activeSession.me.name"
            size="sm"
          />
          <span v-else class="h-8 w-8 flex items-center justify-center border rounded-full bg-muted text-muted-foreground">
            <span class="i-lucide-user h-4 w-4" />
          </span>
        </button>
      </UserDropdown>
    </div>
  </nav>
</template>
