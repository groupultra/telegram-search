<script setup lang="ts">
import { useSessionStore } from '@tg-search/client'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'

import EntityAvatar from '../components/avatar/EntityAvatar.vue'
import ChatListSection from '../components/layout/ChatListSection.vue'
import OptionsDropdown from '../components/layout/OptionsDropdown.vue'

const searchParams = ref('')
const { activeSession } = storeToRefs(useSessionStore())

const username = computed(() => activeSession.value?.me?.name)
</script>

<template>
  <div class="h-full flex flex-col bg-background">
    <!-- Header -->
    <header class="h-14 flex items-center border-b bg-card/50 px-4 py-0 backdrop-blur-sm md:h-16 md:px-6">
      <div class="flex items-center gap-2 md:hidden">
        <EntityAvatar
          v-if="activeSession?.me?.id != null"
          :id="activeSession?.me?.id"
          entity="self"
          entity-type="user"
          :name="username"
          size="sm"
          class="ring-2 ring-background"
        />
        <div
          v-else
          class="h-8 w-8 flex items-center justify-center rounded-full bg-muted text-muted-foreground ring-2 ring-background"
        >
          <span class="i-lucide-user h-4 w-4" />
        </div>
        <span class="text-sm font-semibold hidden sm:inline">{{ username }}</span>
      </div>

      <div class="ml-auto flex items-center md:hidden">
        <OptionsDropdown />
      </div>
    </header>

    <!-- Chat List -->
    <ChatListSection v-model:search-query="searchParams" class="flex-1 overflow-hidden" />
  </div>
</template>
