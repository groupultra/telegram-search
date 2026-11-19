<script setup lang="ts">
import { useSessionStore } from '@tg-search/client'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import EntityAvatar from '../avatar/EntityAvatar.vue'
import OptionsDropdown from './OptionsDropdown.vue'
import UserDropdown from './UserDropdown.vue'

import { useChatPanel } from '../../composables/use-chat-panel'
import { NAV_ICON_CLASS, SIDEBAR_NAV_ITEMS } from '../../constants'
import { ActionIcon } from '../ui/ActionIcon'
import { Tooltip } from '../ui/Tooltip'

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
</script>

<template>
  <nav class="h-full w-14 flex shrink-0 flex-col items-center gap-2 border-r border-line-2 bg-layout py-3">
    <!-- Brand mark -->
    <RouterLink
      to="/"
      class="mb-1 h-8 w-8 flex items-center justify-center rounded-md bg-primary text-primary-foreground"
      aria-label="Telegram Search"
    >
      <span class="i-lucide-search h-4 w-4" />
    </RouterLink>

    <ActionIcon
      icon="i-lucide-search"
      size="lg"
      tooltip-side="right"
      :title="`${t('layout.searchEverything')}  ⌘K`"
      @click="emit('openSearch')"
    />
    <ActionIcon
      icon="i-lucide-messages-square"
      size="lg"
      tooltip-side="right"
      :active="isChatPanelOpen"
      :aria-pressed="isChatPanelOpen"
      :title="isChatPanelOpen ? t('layout.hideChatList') : t('layout.showChatList')"
      @click="toggleChatPanel"
    />

    <div class="h-px w-6 bg-line" />

    <ActionIcon
      v-for="item in navigationItems"
      :key="item.path"
      :as="RouterLink"
      :to="item.path"
      :icon="NAV_ICON_CLASS[item.icon]"
      size="lg"
      tooltip-side="right"
      :active="route.path === item.path"
      :aria-current="route.path === item.path ? 'page' : undefined"
      :title="item.label"
    />

    <div class="mt-auto flex flex-col items-center gap-2">
      <OptionsDropdown side="right" align="end" size="lg" />

      <UserDropdown>
        <Tooltip :content="activeSession?.me?.name || t('settings.notLoggedIn')" side="right">
          <button
            type="button"
            class="h-10 w-10 flex items-center justify-center rounded-md transition-colors hover:bg-fill-2"
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
            <span v-else class="h-8 w-8 flex items-center justify-center rounded-full bg-fill-2 text-fg-3">
              <span class="i-lucide-user h-4 w-4" />
            </span>
          </button>
        </Tooltip>
      </UserDropdown>
    </div>
  </nav>
</template>
