<script setup lang="ts">
import { useChatStore } from '@tg-search/client'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ChatListSection from './ChatListSection.vue'

import { useChatPanel } from '../../composables/use-chat-panel'

const { t } = useI18n()
const chatStore = useChatStore()
const { toggle } = useChatPanel()

const searchQuery = ref('')
const chatCount = computed(() => chatStore.chats?.length ?? 0)
</script>

<template>
  <aside class="h-full flex flex-col bg-sidebar">
    <header class="h-14 flex shrink-0 items-center justify-between gap-2 pl-4 pr-2">
      <div class="min-w-0 flex items-baseline gap-2">
        <h2 class="truncate text-base font-semibold tracking-tight">
          {{ t('layout.chats') }}
        </h2>
        <span v-if="chatCount > 0" class="text-xs text-muted-foreground font-mono tabular-nums">{{ chatCount }}</span>
      </div>
      <button
        type="button"
        class="h-8 w-8 flex shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/6 hover:text-foreground"
        :title="t('layout.hideChatList')"
        :aria-label="t('layout.hideChatList')"
        @click="toggle"
      >
        <span class="i-lucide-panel-left-close h-4 w-4" />
      </button>
    </header>

    <ChatListSection v-model:search-query="searchQuery" />
  </aside>
</template>
