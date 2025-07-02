<script setup lang="ts">
import type { CoreRetrievalMessages } from '@tg-search/core/types'

import { useWebsocketStore } from '@tg-search/client'
import { useDebounce } from '@vueuse/core'
import { ref, watch } from 'vue'

import MessageList from './messages/MessageList.vue'

const props = defineProps<{
  chatId?: string
}>()

const isOpen = defineModel<boolean>('open', { required: true })
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
    chatId: props.chatId,
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
  <div v-if="isOpen" class="flex items-center justify-center" @keydown.esc="isOpen = false">
    <div class="w-[45%] rounded-xl bg-card shadow-lg">
      <!-- 搜索输入框 -->
      <div class="flex items-center gap-2 border-b px-4 py-3">
        <input
          v-model="keyword"
          class="w-full text-primary-900 outline-none"
        >
        <button
          class="h-8 w-8 flex items-center justify-center rounded-md p-1 text-primary-900 hover:bg-neutral-100"
          @click="showSettings = !showSettings"
        >
          <span class="i-lucide-chevron-down h-4 w-4 transition-transform" :class="{ 'rotate-180': showSettings }" />
        </button>
      </div>

      <!-- 设置栏 -->
      <div v-if="showSettings" class="border-b px-4 py-3">
        <slot name="settings" />
      </div>

      <!-- 搜索结果 -->
      <div
        v-show="keywordDebounced"
        class="min-h-[200px] p-4 transition-all duration-300 ease-in-out"
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
  </div>
</template>

<style scoped>
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}

.animate-slide-in {
  animation: slide-in 0.3s ease-out;
}
</style>
