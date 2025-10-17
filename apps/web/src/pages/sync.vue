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
  <div class="bg-background h-full flex flex-col">
    <header class="bg-card/50 flex items-center justify-between border-b px-6 py-4 backdrop-blur-sm">
      <div class="flex items-center gap-3">
        <h1 class="text-lg font-semibold">
          {{ t('sync.sync') }}
        </h1>
      </div>

      <div class="flex items-center gap-2">
        <Button
          icon="i-lucide-refresh-cw"
          variant="ghost"
          size="sm"
          :disabled="isButtonDisabled"
          @click="handleSync"
        >
          {{ t('sync.incrementalSync') }}
        </Button>
        <Button
          icon="i-lucide-rotate-ccw"
          variant="outline"
          size="sm"
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
      class="flex items-center justify-center px-6 py-8"
    >
      <div
        class="max-w-2xl w-full border border-primary/20 rounded-2xl bg-primary/5 p-6 transition-all"
      >
        <div class="flex flex-col items-center justify-center gap-4 md:flex-row md:justify-between">
          <div class="flex items-center gap-4">
            <div class="h-12 w-12 flex flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
              <div class="i-lucide-lock-keyhole h-6 w-6 text-primary" />
            </div>
            <div class="flex flex-col gap-1">
              <span class="text-foreground text-sm font-semibold">{{ t('loginPromptBanner.pleaseLoginToUseFullFeatures') }}</span>
              <span class="text-muted-foreground text-xs">{{ t('loginPromptBanner.subtitle') }}</span>
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

    <div v-else class="flex flex-1 flex-col overflow-hidden p-6">
      <div class="mx-auto h-full max-w-6xl w-full flex flex-col space-y-6">
        <!-- Progress bar -->
        <div
          v-if="isTaskInProgress"
          class="border border-primary/20 rounded-2xl bg-primary/5 p-6 shadow-sm transition-all"
        >
          <div class="space-y-4">
            <div class="flex items-center gap-4">
              <div class="h-12 w-12 flex flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                <div class="i-lucide-loader-2 h-6 w-6 animate-spin text-primary" />
              </div>
              <div class="flex flex-1 flex-col gap-1">
                <span class="text-foreground text-base font-semibold">{{ t('sync.syncing') }}</span>
                <span v-if="currentTask?.lastMessage" class="text-muted-foreground text-sm">{{ currentTask.lastMessage }}</span>
              </div>
            </div>

            <Progress
              :progress="currentTaskProgress"
            />

            <div class="flex justify-end">
              <Button
                icon="i-lucide-x"
                size="sm"
                variant="outline"
                @click="handleAbort"
              >
                {{ t('sync.cancel') }}
              </Button>
            </div>
          </div>
        </div>

        <!-- Chat selector section -->
        <div class="min-h-0 flex flex-1 flex-col space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-foreground text-lg font-semibold">
                {{ t('sync.selectChats') }}
              </h3>
              <p class="text-muted-foreground mt-1 text-sm">
                {{ t('sync.syncPrompt') }}
              </p>
            </div>

            <div class="bg-muted flex items-center gap-2 rounded-full px-4 py-2">
              <span class="i-lucide-check-circle h-4 w-4 text-primary" />
              <span class="text-foreground text-sm font-medium">
                {{ t('sync.selectedChats', { count: selectedChats.length }) }}
              </span>
            </div>
          </div>

          <div class="min-h-0 flex-1 overflow-hidden">
            <ChatSelector
              v-model:selected-chats="selectedChats"
              :chats="chats"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
