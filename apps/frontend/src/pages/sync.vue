<script setup lang="ts">
import type { Action } from '../types/action'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useChatStore } from '../store/useChat'
import { useSessionStore } from '../store/useSession'
import { useSyncTaskStore } from '../store/useSyncTask'

const props = defineProps<{
  changeTitle?: (title: string) => void
  setActions?: (actions: Action[]) => void
  setCollapsed?: (collapsed: boolean) => void
}>()

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

onMounted(() => {
  props.changeTitle?.('同步')
  props.setActions?.([{
    icon: 'i-lucide-refresh-cw',
    name: '开始同步',
    disabled: computed(() => selectedChats.value.length === 0 || !isLoggedIn.value),
    onClick: handleSync,
  }])
  props.setCollapsed?.(true)
})
</script>

<template>
  <div class="space-y-4">
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
