<script setup lang="ts">
import type { CoreRetrievalMessages } from '@tg-search/core'

import { useDebounce } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import MessageList from '../../components/messages/MessageList.vue'
import LoginPrompt from '../../components/ui/LoginPrompt.vue'
import { useAuthStore } from '../../store/useAuth'
import { useWebsocketStore } from '../../store/useWebsocket'

const isLoading = ref(false)
const showSettings = ref(false)

const keyword = ref<string>('')
const keywordDebounced = useDebounce(keyword, 1000)

const authStore = useAuthStore()
const { isLoggedIn } = storeToRefs(authStore)
const router = useRouter()

const websocketStore = useWebsocketStore()
const searchResult = ref<CoreRetrievalMessages[]>([])

// TODO: Infinite scroll
watch(keywordDebounced, (newKeyword) => {
  if (!isLoggedIn.value || newKeyword.length === 0) {
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

function handleLoginClick() {
  router.push('/login')
}
</script>

<template>
  <div class="flex flex-col h-full">
    <header class="flex items-center border-b border-b-secondary px-4 dark:border-b-secondary p-4">
      <div class="flex items-center gap-2">
        <span class="text-lg font-medium">Search</span>
      </div>
    </header>

    <!-- 未登录提示 -->
    <div v-if="!isLoggedIn" class="flex-1 flex items-center justify-center p-6">
      <div class="max-w-md bg-card rounded-lg overflow-hidden shadow-md">
        <div class="bg-primary/10 p-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <span class="i-lucide-search-x text-xl text-primary"></span>
            </div>
            <h3 class="text-lg font-medium text-foreground">无法搜索</h3>
          </div>
        </div>
        
        <div class="p-4">
          <p class="text-muted-foreground mb-4">
            您需要登录 Telegram 账号才能搜索消息。登录后，您可以搜索所有已同步的聊天记录。
          </p>
          
          <div class="flex justify-end">
            <Button 
              icon="i-lucide-log-in"
              @click="handleLoginClick"
            >
              立即登录
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- 已登录状态 -->
    <div v-else class="flex-1 flex flex-col">
      <!-- 搜索栏直接放在页面顶部 -->
      <div class="flex flex-col px-8 pt-8">
        <div class="flex items-center gap-2 w-full">
          <input
            v-model="keyword"
            class="flex-1 outline-none text-foreground border border-secondary rounded-md px-4 py-2"
            placeholder="Search messages..."
          >
          <button
            class="h-8 w-8 flex items-center justify-center rounded-md p-1 text-foreground hover:bg-muted"
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
        class="px-8 pt-4 flex-1 transition-all duration-300 ease-in-out"
        :class="{ 'opacity-0': !keywordDebounced, 'opacity-100': keywordDebounced }"
      >
        <template v-if="searchResult.length > 0">
          <MessageList :messages="searchResult" :keyword="keyword" />
        </template>
        <template v-else-if="isLoading">
          <div class="flex flex-col items-center justify-center py-12 text-muted-foreground opacity-70">
            <span class="i-lucide-loader-circle text-3xl mb-2 animate-spin" />
            <span>搜索中...</span>
          </div>
        </template>
        <template v-else-if="searchResult.length === 0">
          <div class="flex flex-col items-center justify-center py-12 text-muted-foreground opacity-70">
            <span class="i-lucide-search text-3xl mb-2" />
            <span>没有找到相关消息</span>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
