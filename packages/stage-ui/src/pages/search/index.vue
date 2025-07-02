<script setup lang="ts">
import type { CoreRetrievalMessages } from '@tg-search/core/types'

import { useWebsocketStore } from '@tg-search/client'
import { useDebounce } from '@vueuse/core'
import { ref, watch } from 'vue'

import MessageList from '../../components/messages/MessageList.vue'

const isLoading = ref(false)
const showSettings = ref(false)

const keyword = ref<string>('')
const keywordDebounced = useDebounce(keyword, 1000)

const websocketStore = useWebsocketStore()
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
    <header class="flex items-center border-b border-b-neutral-200 p-4 px-4 dark:border-b-neutral-200">
      <div class="flex items-center gap-2">
        <span class="text-lg font-medium">Search</span>
      </div>
    </header>

    <!-- 搜索栏直接放在页面顶部 -->
    <div class="flex flex-col px-8 pt-8">
      <div class="w-full flex items-center gap-2">
        <input
          v-model="keyword"
          class="flex-1 border border-neutral-200 rounded-md px-4 py-2 text-primary-900 outline-none"
          placeholder="Search messages..."
        >
        <button
          class="h-8 w-8 flex items-center justify-center rounded-md p-1 text-primary-900 hover:bg-neutral-100"
          @click="showSettings = !showSettings"
        >
          <span class="i-lucide-chevron-down h-4 w-4 transition-transform" :class="{ 'rotate-180': showSettings }" />
        </button>
      </div>

      <!-- 设置栏 -->
      <div v-if="showSettings" class="py-3">
        <slot name="settings" />
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
        <div class="flex flex-col items-center justify-center py-12 text-complementary-500 opacity-70">
          <span class="i-lucide-loader-circle mb-2 animate-spin text-3xl" />
          <span>搜索中...</span>
        </div>
      </template>
      <template v-else-if="searchResult.length === 0">
        <div class="flex flex-col items-center justify-center py-12 text-complementary-500 opacity-70">
          <span class="i-lucide-search mb-2 text-3xl" />
          <span>没有找到相关消息</span>
        </div>
      </template>
    </div>
  </div>
</template>
