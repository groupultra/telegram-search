<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import ChatSelector from '../components/ChatSelector.vue'
import { Button } from '../components/ui/Button'
import { useChatStore } from '../store/useChat'
import { useSessionStore } from '../store/useSession'
import { useSyncTaskStore } from '../store/useSyncTask'
import { useWebsocketStore } from '../store/useWebsocket'

const selectedChats = ref<number[]>([])

const sessionStore = useSessionStore()
const { isLoggedIn } = storeToRefs(sessionStore)
const websocketStore = useWebsocketStore()

const chatsStore = useChatStore()
const { chats } = storeToRefs(chatsStore)

const { currentTask, currentTaskProgress } = storeToRefs(useSyncTaskStore())
const loadingToast = ref<string | number>()

function handleSync() {
  websocketStore.sendEvent('takeout:run', {
    chatIds: selectedChats.value.map(id => id.toString()),
  })

  loadingToast.value = toast.loading('开始同步...')
}

function handleAbort() {
  if (currentTask.value) {
    websocketStore.sendEvent('takeout:task:abort', {
      taskId: currentTask.value.taskId,
    })
  }
  else {
    toast.error('没有正在进行的同步任务')
  }
}

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
    loadingToast.value = toast.loading(currentTask.value?.lastMessage ?? '同步中...', {
      action: {
        label: '取消',
        onClick: handleAbort,
      },
    })
  }
})
</script>

<template>
  <header class="flex items-center border-b border-b-secondary px-4 dark:border-b-secondary p-4">
    <div class="flex items-center gap-2">
      <span class="text-lg font-medium">Sync</span>
    </div>

    <div class="ml-auto flex items-center gap-2">
      <Button
        icon="i-lucide-refresh-cw"
        :disabled="selectedChats.length === 0 || !isLoggedIn || !!currentTask"
        @click="handleSync"
      >
        同步
      </Button>
    </div>
  </header>

  <div class="p-6">
    <div class="flex items-center justify-between">
      <h3 class="text-lg text-foreground font-medium">
        选择要同步的聊天
      </h3>
      <div class="flex items-center gap-2">
        <span class="text-sm text-secondary-foreground">
          已选择 {{ selectedChats.length }} 个聊天
        </span>
      </div>
    </div>

    <ChatSelector
      v-model:selected-chats="selectedChats"
      :chats="chats"
    />
  </div>
</template>
