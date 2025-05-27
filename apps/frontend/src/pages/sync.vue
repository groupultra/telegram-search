<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useRouter } from 'vue-router'

import ChatSelector from '../components/ChatSelector.vue'
import { Button } from '../components/ui/Button'
import LoadingState from '../components/ui/LoadingState.vue'
import LoginPrompt from '../components/ui/LoginPrompt.vue'
import { useChatStore } from '../store/useChat'
import { useAuthStore } from '../store/useAuth'
import { useSyncTaskStore } from '../store/useSyncTask'
import { useWebsocketStore } from '../store/useWebsocket'

const selectedChats = ref<number[]>([])
const syncError = ref('')

const sessionStore = useAuthStore()
const { isLoggedIn } = storeToRefs(sessionStore)
const websocketStore = useWebsocketStore()
const router = useRouter()

const chatsStore = useChatStore()
const { chats } = storeToRefs(chatsStore)

const syncTaskStore = useSyncTaskStore()
const { currentTask, currentTaskProgress } = storeToRefs(syncTaskStore)

// 计算属性判断按钮是否应该禁用
const isButtonDisabled = computed(() => {
  // 只有在任务进行中并且进度小于100且不为负数时才禁用按钮
  const isTaskInProgress = !!currentTask.value && currentTaskProgress.value >= 0 && currentTaskProgress.value < 100
  return selectedChats.value.length === 0 || !isLoggedIn.value || isTaskInProgress
})

async function handleSync() {
  // 如果未登录，引导用户登录
  if (!isLoggedIn.value) {
    router.push('/login')
    return
  }

  // 清除之前的错误
  syncError.value = ''
  
  try {
    websocketStore.sendEvent('takeout:run', {
      chatIds: selectedChats.value.map(id => id.toString()),
    })
  } catch (error) {
    console.error('同步失败:', error)
    syncError.value = '启动同步任务失败，可能是服务器问题'
  }
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
  if (progress === 100) {
    toast.success('同步完成')
    syncError.value = ''
  }
  else if (progress < 0 && currentTask.value?.lastError) {
    syncError.value = currentTask.value.lastError
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
        :disabled="isButtonDisabled"
        @click="handleSync"
      >
        同步
      </Button>
      <Button
        v-if="!!currentTask && currentTaskProgress >= 0 && currentTaskProgress < 100"
        variant="destructive"
        icon="i-lucide-x"
        @click="handleAbort"
      >
        取消
      </Button>
    </div>
  </header>

  <div class="p-6">
    <!-- 未登录提示 -->
    <div v-if="!isLoggedIn" class="flex flex-col items-center justify-center py-12">
      <div class="w-full max-w-md bg-card rounded-lg overflow-hidden shadow-md">
        <div class="bg-primary/10 p-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <span class="i-lucide-alert-triangle text-xl text-primary"></span>
            </div>
            <h3 class="text-lg font-medium text-foreground">需要登录</h3>
          </div>
        </div>
        
        <div class="p-4">
          <p class="text-muted-foreground mb-4">
            您需要登录 Telegram 账号才能同步聊天记录。登录后，您可以选择要同步的聊天，并将其导入到数据库中。
          </p>
          
          <div class="flex flex-col space-y-2">
            <Button 
              icon="i-lucide-log-in"
              @click="router.push('/login')"
            >
              立即登录
            </Button>
            <Button 
              icon="i-lucide-home"
              @click="router.push('/')"
            >
              返回首页
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- 已登录状态 -->
    <div v-else>
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

      <!-- 错误显示 -->
      <div 
        v-if="syncError" 
        class="my-4 bg-destructive/10 border border-destructive rounded-md p-3 text-destructive"
      >
        <div class="flex items-start gap-2">
          <span class="i-lucide-alert-triangle mt-0.5 flex-shrink-0" />
          <div>
            <p class="font-medium">同步错误</p>
            <p class="text-sm mt-1">{{ syncError }}</p>
            <p class="text-xs mt-2 opacity-80">如果问题持续存在，请联系管理员或检查服务器日志。</p>
            <p class="text-xs opacity-70">错误详情: crypto is not defined</p>
          </div>
        </div>
      </div>

      <!-- 同步进度条 -->
      <div 
        v-if="!!currentTask && currentTaskProgress >= 0 && currentTaskProgress < 100" 
        class="my-4 bg-muted rounded-md overflow-hidden"
      >
        <div 
          class="h-2 bg-primary transition-all duration-300 ease-out" 
          :style="`width: ${currentTaskProgress}%`"
        />
        <div class="p-2 text-sm text-muted-foreground text-center">
          {{ currentTask.lastMessage || '同步中...' }} ({{ Math.round(currentTaskProgress) }}%)
        </div>
      </div>

      <ChatSelector
        v-model:selected-chats="selectedChats"
        :chats="chats"
      />
    </div>
  </div>
</template>
