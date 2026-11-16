<script setup lang="ts">
import { useSessionStore } from '@tg-search/client'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import EntityAvatar from '../components/avatar/EntityAvatar.vue'
import ChatListSection from '../components/layout/ChatListSection.vue'
import OptionsDropdown from '../components/layout/OptionsDropdown.vue'
import UserDropdown from '../components/layout/UserDropdown.vue'

import { Button } from '../components/ui/Button'

const { t } = useI18n()
const searchParams = ref('')
const { activeSession } = storeToRefs(useSessionStore())

const username = computed(() => activeSession.value?.me?.name)

function openGlobalSearch() {
  window.dispatchEvent(new Event('tg-search:open-global-search'))
}
</script>

<template>
  <div class="h-full flex flex-col bg-background">
    <!-- Header -->
    <header class="h-14 flex shrink-0 items-center gap-3 px-4 md:px-6">
      <UserDropdown class="md:hidden">
        <button type="button" class="flex items-center md:hidden" :aria-label="username">
          <EntityAvatar
            v-if="activeSession?.me?.id != null"
            :id="activeSession?.me?.id"
            entity="self"
            entity-type="user"
            :name="username"
            size="sm"
          />
          <span
            v-else
            class="h-8 w-8 flex items-center justify-center border rounded-full bg-muted text-muted-foreground"
          >
            <span class="i-lucide-user h-4 w-4" />
          </span>
        </button>
      </UserDropdown>

      <h1 class="text-lg font-semibold tracking-tight">
        {{ t('layout.chats') }}
      </h1>

      <div class="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          class="h-9 w-9"
          :aria-label="t('layout.searchEverything')"
          @click="openGlobalSearch"
        >
          <span class="i-lucide-search h-4.5 w-4.5" />
        </Button>
        <OptionsDropdown />
      </div>
    </header>

    <!-- Chat List -->
    <ChatListSection v-model:search-query="searchParams" class="flex-1 overflow-hidden" />
  </div>
</template>
