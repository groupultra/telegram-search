<script setup lang="ts">
import { useChatStore } from '@tg-search/client'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ChatListSection from './ChatListSection.vue'

import { useChatPanel } from '../../composables/use-chat-panel'
import { ActionIcon } from '../ui/ActionIcon'

const { t } = useI18n()
const chatStore = useChatStore()
const { toggle } = useChatPanel()

const searchQuery = ref('')
const chatCount = computed(() => chatStore.chats?.length ?? 0)
</script>

<template>
  <aside class="h-full flex flex-col bg-layout">
    <header class="h-14 flex shrink-0 items-center justify-between gap-2 pl-4 pr-3">
      <div class="min-w-0 flex items-baseline gap-2">
        <h2 class="truncate text-base text-fg font-semibold leading-6">
          {{ t('layout.chats') }}
        </h2>
        <span v-if="chatCount > 0" class="text-xs text-fg-3">{{ chatCount }}</span>
      </div>
      <ActionIcon icon="i-lucide-panel-left-close" :title="t('layout.hideChatList')" @click="toggle" />
    </header>

    <ChatListSection v-model:search-query="searchQuery" />
  </aside>
</template>
