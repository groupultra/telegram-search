<script setup lang="ts">
import { useAuthStore, useBridgeStore, useChatStore, useSyncTaskStore } from '@tg-search/client'
import NProgress from 'nprogress'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import ChatSelector from '../components/ChatSelector.vue'
import { Button } from '../components/ui/Button'
import { Progress } from '../components/ui/Progress'

const { t } = useI18n()
const router = useRouter()

const selectedChats = ref<number[]>([])

const sessionStore = useAuthStore()
const { isLoggedIn } = storeToRefs(sessionStore)
const websocketStore = useBridgeStore()

const chatsStore = useChatStore()
const { chats } = storeToRefs(chatsStore)

const { currentTask, currentTaskProgress, increase } = storeToRefs(useSyncTaskStore())

// Default to incremental sync
if (increase.value === undefined || increase.value === null) {
  increase.value = true
}

// Task in progress status
const isTaskInProgress = computed(() => {
  return !!currentTask.value && currentTaskProgress.value >= 0 && currentTaskProgress.value < 100
})

// Disable buttons during sync or when no chats selected
const isButtonDisabled = computed(() => {
  return selectedChats.value.length === 0 || !isLoggedIn.value || isTaskInProgress.value
})

function handleSync() {
  increase.value = true
  websocketStore.sendEvent('takeout:run', {
    chatIds: selectedChats.value.map(id => id.toString()),
    increase: true,
  })

  NProgress.start()
}

function handleResync() {
  increase.value = false
  websocketStore.sendEvent('takeout:run', {
    chatIds: selectedChats.value.map(id => id.toString()),
    increase: false,
  })

  NProgress.start()
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
  if (progress === 100) {
    toast.success(t('sync.syncCompleted'))
    NProgress.done()
    increase.value = true
  }
  else if (progress < 0 && currentTask.value?.lastError) {
    toast.error(currentTask.value.lastError)
    NProgress.done()
  }
  else if (progress >= 0 && progress < 100) {
    NProgress.set(progress / 100)
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
      <Button
        icon="i-lucide-rotate-ccw"
        :disabled="isButtonDisabled"
        @click="handleResync"
      >
        {{ t('sync.resync') }}
      </Button>
    </div>
  </header>

  <!-- Login prompt banner -->
  <div
    v-if="!isLoggedIn"
    class="flex items-center justify-center px-4 py-6"
  >
    <div
      class="max-w-2xl w-full border border-primary/20 rounded-xl bg-primary/5 p-6 transition-all dark:border-primary/30 dark:bg-primary/10"
    >
      <div class="flex flex-col items-center justify-center gap-4 md:flex-row md:justify-between">
        <div class="flex items-center gap-4">
          <div class="h-10 w-10 flex flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 dark:bg-primary/20">
            <div class="i-lucide-lock-keyhole h-5 w-5 text-primary" />
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="text-sm text-foreground font-medium">{{ t('loginPromptBanner.pleaseLoginToUseFullFeatures') }}</span>
            <span class="text-xs text-muted-foreground">{{ t('loginPromptBanner.subtitle') }}</span>
          </div>
        </div>
        <Button
          size="md"
          icon="i-lucide-log-in"
          class="flex-shrink-0"
          @click="router.push('/login')"
        >
          {{ t('loginPromptBanner.login') }}
        </Button>
      </div>
    </div>
  </div>

  <div v-else class="p-6 space-y-6">
    <!-- Progress bar -->
    <div v-if="isTaskInProgress" class="space-y-3">
      <Progress
        :progress="currentTaskProgress"
        :label="t('sync.syncing')"
        :message="currentTask?.lastMessage"
      />
      <div class="flex justify-end">
        <Button
          icon="i-lucide-x"
          size="sm"
          @click="handleAbort"
        >
          {{ t('sync.cancel') }}
        </Button>
      </div>
    </div>

    <!-- Chat selector section -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-lg text-gray-900 font-medium dark:text-gray-100">
          {{ t('sync.syncPrompt') }}
        </h3>

        <span class="text-sm text-gray-600 dark:text-gray-400">
          {{ t('sync.selectedChats', { count: selectedChats.length }) }}
        </span>
      </div>

      <ChatSelector
        v-model:selected-chats="selectedChats"
        :chats="chats"
      />
    </div>
  </div>
</template>
