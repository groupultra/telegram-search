<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import MessageList from '../../components/messages/MessageList.vue'

import { useMessageSearch } from '../../composables/useMessageSearch'

const { t } = useI18n()

const route = useRoute('/search/:id')
const id = String(route.params.id)

const {
  isLoading,
  keyword,
  keywordDebounced,
  searchResult,
} = useMessageSearch({
  chatId: id,
})
</script>

<template>
  <div class="h-full flex flex-col">
    <header class="h-14 flex items-center border-b bg-card/50 px-4 py-0 backdrop-blur-sm md:h-16 md:px-6">
      <div class="flex items-center gap-3">
        <h1 class="text-lg font-semibold">
          {{ t('search.search') }}
        </h1>
      </div>
    </header>

    <!-- Search bar placed directly at the top of the page -->
    <div class="flex flex-col px-8 pt-8">
      <div class="mx-auto max-w-4xl w-full flex items-center gap-2">
        <div class="relative flex flex-1 items-center">
          <span class="i-lucide-search absolute left-4 h-5 w-5 text-muted-foreground" />
          <input
            v-model="keyword"
            class="h-12 w-full border rounded-xl bg-background px-4 py-3 pl-12 pr-4 text-sm shadow-sm transition-all duration-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            :placeholder="t('search.searchMessages')"
          >
        </div>
      </div>
    </div>

    <!-- Search results displayed directly below -->
    <div
      v-show="keywordDebounced"
      class="flex-1 px-8 pt-4 transition-all duration-300 ease-in-out"
      :class="{ 'opacity-0': !keywordDebounced, 'opacity-100': keywordDebounced }"
    >
      <template v-if="searchResult.length > 0">
        <MessageList :messages="searchResult" :keyword="keyword" />
      </template>
      <template v-else-if="isLoading">
        <div class="flex flex-col items-center justify-center py-12 text-muted-foreground opacity-70">
          <span class="i-lucide-loader-circle mb-2 animate-spin text-3xl" />
          <span>{{ t('search.searching') }}</span>
        </div>
      </template>
      <template v-else-if="searchResult.length === 0">
        <div class="flex flex-col items-center justify-center py-12 text-muted-foreground opacity-70">
          <span class="i-lucide-search mb-2 text-3xl" />
          <span>{{ t('search.noRelatedMessages') }}</span>
        </div>
      </template>
    </div>
  </div>
</template>
