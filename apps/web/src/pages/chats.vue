<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ChatListSection from '../components/layout/ChatListSection.vue'
import OptionsDropdown from '../components/layout/OptionsDropdown.vue'
import UserDropdown from '../components/layout/UserDropdown.vue'

import { ActionIcon } from '../components/ui/ActionIcon'

const { t } = useI18n()
const searchParams = ref('')

function openGlobalSearch() {
  window.dispatchEvent(new Event('tg-search:open-global-search'))
}
</script>

<template>
  <div class="h-full flex flex-col bg-layout">
    <!-- Header -->
    <header class="h-14 flex shrink-0 items-center gap-3 px-3">
      <UserDropdown class="md:hidden" />

      <h1 class="text-base text-fg font-semibold leading-6">
        {{ t('layout.chats') }}
      </h1>

      <div class="ml-auto flex items-center gap-1">
        <ActionIcon icon="i-lucide-search" :title="t('layout.searchEverything')" @click="openGlobalSearch" />
        <OptionsDropdown />
      </div>
    </header>

    <!-- Chat List -->
    <ChatListSection v-model:search-query="searchParams" class="flex-1 overflow-hidden" />
  </div>
</template>
