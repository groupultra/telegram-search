<script setup lang="ts">
import type { CoreRetrievalMessages } from '@tg-search/core/types'

import { useBridgeStore } from '@tg-search/client'
import { useDebounce } from '@vueuse/core'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import MessageList from '../../components/messages/MessageList.vue'

const { t } = useI18n()

const isLoading = ref(false)

const keyword = ref<string>('')
const keywordDebounced = useDebounce(keyword, 1000)

const websocketStore = useBridgeStore()
const searchResult = ref<CoreRetrievalMessages[]>([])

// TODO: Infinite scroll
watch(keywordDebounced, (newKeyword) => {
  if (newKeyword.length === 0) {
    searchResult.value = []
    return
  }

  isLoading.value = true
  websocketStore.sendEvent('storage:search:messages', {
    content: newKeyword,
    useVector: true,
    pagination: {
      limit: 10,
      offset: 0,
    },
  })

  websocketStore.waitForEvent('storage:search:messages:data').then(({ messages }) => {
    searchResult.value = messages
    isLoading.value = false
  })
})
</script>

<template>
  <div class="h-full flex flex-col">
    <header class="flex items-center border-b border-b-neutral-200 p-4 px-4 dark:border-b-gray-700">
      <div class="flex items-center gap-2">
        <span class="text-lg text-gray-900 font-medium dark:text-gray-100">{{ t('search.search') }}</span>
      </div>
    </header>

    <!-- 搜索栏直接放在页面顶部 -->
    <div class="flex flex-col px-8 pt-8">
      <div class="mx-auto max-w-4xl w-full flex items-center gap-2">
        <div class="relative flex flex-1 items-center">
          <span class="i-lucide-search absolute left-4 h-5 w-5 text-muted-foreground" />
          <input
            v-model="keyword"
            class="h-12 w-full border rounded-xl bg-background px-4 py-3 pl-12 pr-4 text-sm shadow-sm transition-all duration-200 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
            :placeholder="t('search.searchMessages')"
          >
        </div>
      </div>
    </div>

    <!-- 搜索结果直接展示在下方 -->
    <div
      v-show="keywordDebounced"
      class="flex-1 px-8 pt-4 transition-all duration-300 ease-in-out"
      :class="{ 'opacity-0': !keywordDebounced, 'opacity-100': keywordDebounced }"
    >
      <template v-if="searchResult.length > 0">
        <MessageList :messages="searchResult" :keyword="keyword" />
      </template>
      <template v-else-if="isLoading">
        <div class="flex flex-col items-center justify-center py-12 text-gray-500 opacity-70 dark:text-gray-400">
          <span class="i-lucide-loader-circle mb-2 animate-spin text-3xl" />
          <span>{{ t('search.searching') }}</span>
        </div>
      </template>
      <template v-else-if="searchResult.length === 0">
        <div class="flex flex-col items-center justify-center py-12 text-gray-500 opacity-70 dark:text-gray-400">
          <span class="i-lucide-search mb-2 text-3xl" />
          <span>{{ t('search.noRelatedMessages') }}</span>
        </div>
      </template>
    </div>
  </div>
</template>
