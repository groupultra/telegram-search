<script setup lang="ts">
import { useAuthStore, useBridgeStore, useChatStore, useSyncTaskStore } from '@tg-search/client'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import ChatSelector from '../components/ChatSelector.vue'
import { Button } from '../components/ui/Button'
import { Switch } from '../components/ui/Switch'

const { t } = useI18n()

const selectedChats = ref<number[]>([])

const sessionStore = useAuthStore()
const { isLoggedIn } = storeToRefs(sessionStore)
const websocketStore = useBridgeStore()

const chatsStore = useChatStore()
const { chats } = storeToRefs(chatsStore)

const { currentTask, currentTaskProgress, increase } = storeToRefs(useSyncTaskStore())
const loadingToast = ref<string | number>()

// 计算属性判断按钮是否应该禁用
const isButtonDisabled = computed(() => {
  // 只有在任务进行中并且进度小于100且不为负数时才禁用按钮
  const isTaskInProgress = !!currentTask.value && currentTaskProgress.value >= 0 && currentTaskProgress.value < 100
  return selectedChats.value.length === 0 || !isLoggedIn.value || isTaskInProgress
})

function handleSync() {
  websocketStore.sendEvent('takeout:run', {
    chatIds: selectedChats.value.map(id => id.toString()),
    increase: increase.value,
  })

  loadingToast.value = toast.loading(t('sync.startSync'))
}

function handleAbort() {
  if (currentTask.value) {
    websocketStore.sendEvent('takeout:task:abort', {
      taskId: currentTask.value.taskId,
    })
  }
  else {
    toast.error(t('sync.noInProgressTask'))
  }
}

watch(currentTaskProgress, (progress) => {
  toast.dismiss(loadingToast?.value)

  if (progress === 100) {
    toast.dismiss(loadingToast.value)
    toast.success(t('sync.syncCompleted'))
  }
  else if (progress < 0 && currentTask.value?.lastError) {
    toast.dismiss(loadingToast.value)
    toast.error(currentTask.value.lastError)
  }
  else {
    loadingToast.value = toast.loading(currentTask.value?.lastMessage ?? t('sync.syncing'), {
      action: {
        label: t('sync.cancel'),
        onClick: handleAbort,
      },
    })
  }
})
</script>

<template>
  <header class="flex items-center border-b border-b-secondary p-4 px-4 dark:border-b-gray-700">
    <div class="flex items-center gap-2">
      <span class="text-lg text-gray-900 font-medium dark:text-gray-100">{{ t('sync.sync') }}</span>
    </div>

    <div class="ml-auto flex items-center gap-2">
      <Button
        icon="i-lucide-refresh-cw"
        :disabled="isButtonDisabled"
        @click="handleSync"
      >
        {{ t('sync.sync') }}
      </Button>
    </div>
  </header>

  <div class="p-6">
    <div class="flex items-center justify-between">
      <h3 class="text-lg text-gray-900 font-medium dark:text-gray-100">
        {{ t('sync.selectChats') }}
      </h3>
      <div class="flex items-center gap-2">
        <div>
          <Switch
            v-model="increase"
            :label="t('sync.incrementalSync')"
          />
        </div>
        <span class="text-sm text-gray-600 dark:text-gray-400">
          {{ t('sync.selectedChats', { count: selectedChats.length }) }}
        </span>
      </div>
    </div>

    <ChatSelector
      v-model:selected-chats="selectedChats"
      :chats="chats"
    />
  </div>
</template>
