<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useChatStore } from '../composables/useChat'
import { useSessionStore } from '../store/useSessionV2'
import { useSyncTaskStore } from '../store/useSyncTask'

const selectedChats = ref<string[]>([])

const sessionStore = useSessionStore()
const { getWsContext } = sessionStore
const { isLoggedIn } = storeToRefs(sessionStore)

const chatsStore = useChatStore()
const { chats } = storeToRefs(chatsStore)

// const currentTask = ref<Task<'takeout'> | null>(null)
const loadingToast = ref<string | number>()

function handleSync() {
  const wsContext = getWsContext()
  wsContext.sendEvent('takeout:run', {
    chatIds: selectedChats.value,
  })

  loadingToast.value = toast.loading('开始同步...')
}

const { currentTask, currentTaskProgress } = storeToRefs(useSyncTaskStore())
watch(currentTaskProgress, (progress) => {
  toast.dismiss(loadingToast?.value)

  if (progress === 100) {
    toast.dismiss(loadingToast.value)
    toast.success('同步完成')
  }
  else if (progress < 0 && currentTask.value?.lastError) {
    toast.dismiss(loadingToast.value)
    toast.error(currentTask.value.lastError)
  }
  else {
    loadingToast.value = toast.loading(`同步中... ${progress}%`)
  }
})
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
