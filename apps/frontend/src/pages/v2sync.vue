<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { useChats } from '../store/useChats'
import { useSessionStore } from '../store/useSessionV2'

const selectedChats = ref<string[]>([])

const sessionStore = useSessionStore()
const { getWsContext } = sessionStore
const { isLoggedIn } = storeToRefs(sessionStore)

const chatsStore = useChats()
const { chats } = storeToRefs(chatsStore)

function handleSync() {
  const wsContext = getWsContext()
  wsContext.sendEvent('takeout:run', {
    chatIds: selectedChats.value,
  })
  toast.success('同步开始')
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-medium">
        选择要同步的聊天
      </h3>
      <div class="flex items-center gap-2">
        <span class="text-sm text-gray-500">
          已选择 {{ selectedChats.length }} 个聊天
        </span>
        <button
          class="rounded-md bg-blue-500 px-4 py-2 text-white disabled:cursor-not-allowed hover:bg-blue-600 disabled:opacity-50"
          :disabled="selectedChats.length === 0 || !isLoggedIn"
          @click="handleSync"
        >
          开始同步
        </button>
      </div>
    </div>

    <ChatSelector
      v-model:selected-chats="selectedChats"
      :chats="chats"
    />
  </div>
</template>
