<!-- Sync status component -->
<script setup lang="ts">
import type { Command, CommandStatus } from '@tg-search/server'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useStatus } from '../../composables/useStatus'
import { formatNumberToReadable } from '../../helper'
import ProgressBar from '../ui/ProgressBar.vue'
import StatusBadge from '../ui/StatusBadge.vue'

const props = defineProps<{
  command: Command
  progress: number
  waitingTimeLeft?: number
}>()

const { t } = useI18n()
const { statusText, statusIcon } = useStatus(props.command)

const isWaiting = computed(() => props.command?.status === 'waiting')

interface ChatStatus {
  chatId: number
  status: CommandStatus
  progress: number
  totalMessages?: number
  processedMessages?: number
  failedMessages?: number
  error?: Error | string
}

// Sync details from metadata
const syncDetails = computed(() => {
  if (!props.command || !props.command.metadata) {
    return null
  }

  const metadata = props.command.metadata
  return {
    // Task level information
    totalTasks: metadata.totalTasks as number,
    completedTasks: metadata.completedTasks as number,
    taskProgress: metadata.taskProgress as number,
    currentChatId: metadata.chatId as number,
    type: metadata.type as 'metadata' | 'messages',
    chatStatuses: metadata.chatStatuses as ChatStatus[],

    // Current chat information
    totalMessages: metadata.totalMessages as number,
    processedMessages: metadata.processedMessages as number,
    failedMessages: metadata.failedMessages as number,
  }
})

// Helper computed properties
const currentTaskInfo = computed(() => {
  if (!syncDetails.value)
    return null

  return {
    current: syncDetails.value.completedTasks,
    total: syncDetails.value.totalTasks,
    progress: syncDetails.value.taskProgress,
  }
})

const currentChatInfo = computed(() => {
  if (!syncDetails.value?.currentChatId || !syncDetails.value?.chatStatuses)
    return null

  return syncDetails.value.chatStatuses.find(
    status => status.chatId === syncDetails.value?.currentChatId,
  )
})

const currentChatProgress = computed(() => {
  if (!currentChatInfo.value)
    return 0
  return currentChatInfo.value.progress
})

const chatStatuses = computed(() => {
  if (!syncDetails.value?.chatStatuses)
    return []
  return syncDetails.value.chatStatuses
})

const failedChats = computed(() => {
  return chatStatuses.value.filter(chat => chat.status === 'failed')
})

const hasFailedChats = computed(() => failedChats.value.length > 0)

// Add these computed properties after the existing ones
const statusOrder = {
  running: 0,
  pending: 1,
  completed: 2,
  failed: 3,
} as const

const allChats = computed(() => {
  if (!syncDetails.value?.chatStatuses)
    return []
  return [...syncDetails.value.chatStatuses].sort((a, b) => {
    // Handle 'waiting' status by placing it at the end
    if (a.status === 'waiting')
      return 1
    if (b.status === 'waiting')
      return -1
    return statusOrder[a.status] - statusOrder[b.status]
  })
})

const totalMessagesAcrossChats = computed(() => {
  return chatStatuses.value.reduce((sum, chat) => sum + (chat.totalMessages || 0), 0)
})

const processedMessagesAcrossChats = computed(() => {
  return chatStatuses.value.reduce((sum, chat) => sum + (chat.processedMessages || 0), 0)
})
</script>

<template>
  <div
    v-if="command"
    class="overflow-hidden rounded-lg bg-white transition-all duration-300 dark:bg-gray-800 dark:text-gray-100"
  >
    <div class="p-5">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="flex items-center text-lg font-semibold">
          <span class="mr-2">{{ t('component.sync_command.sync_status') }}</span>
          <span
            v-if="command.status === 'running'"
            class="inline-block animate-spin text-yellow-500"
          >
            <Icon :icon="statusIcon" />
          </span>
        </h2>
        <StatusBadge
          :status="command.status"
          :label="statusText"
          :icon="statusIcon"
        />
      </div>

      <!-- Overall Progress -->
      <div class="mb-3">
        <div class="mb-2 flex items-center justify-between text-sm">
          <span class="text-gray-600 dark:text-gray-300">{{ t('component.sync_command.overall_progress') }}</span>
          <span class="font-medium">{{ progress }}%</span>
        </div>
        <ProgressBar
          :progress="progress"
          :status="command.status"
        />
        <div class="mt-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{{ t('component.sync_command.chats') }}: {{ currentTaskInfo?.current || 0 }}/{{ currentTaskInfo?.total || 0 }}</span>
          <span>{{ t('component.sync_command.messages') }}: {{ formatNumberToReadable(processedMessagesAcrossChats) }}/{{ formatNumberToReadable(totalMessagesAcrossChats) }}</span>
        </div>
      </div>

      <!-- Current Chat Progress -->
      <div v-if="currentChatInfo" class="mb-5">
        <div class="mb-2">
          <div class="flex items-center justify-between text-sm">
            <span class="text-gray-600 dark:text-gray-300">
              {{ t('component.sync_command.current_chat_progress') }}
              <span class="text-blue-600 dark:text-blue-400">(ID: {{ currentChatInfo.chatId }})</span>
            </span>
            <span class="font-medium">{{ currentChatProgress }}%</span>
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400">
            {{ formatNumberToReadable(currentChatInfo.processedMessages || 0) }}/{{ formatNumberToReadable(currentChatInfo.totalMessages || 0) }} {{ t('component.sync_command.messages') }}
          </div>
        </div>
        <ProgressBar
          :progress="currentChatProgress"
          :status="command.status"
          class="bg-blue-100 dark:bg-blue-900/30"
        >
          <div
            class="h-full rounded-full bg-blue-500 transition-all duration-300"
            :style="{ width: `${currentChatProgress}%` }"
          />
        </ProgressBar>
      </div>

      <!-- 等待提示 -->
      <div v-if="isWaiting" class="mb-5 animate-fade-in rounded-md bg-yellow-50 p-3 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
        <p class="flex items-center">
          <span class="mr-2 text-lg">
            <Icon icon="lucide:clock" />
          </span>
          <span>{{ t('component.export_command.telegram_limit', { waitingTimeLeft }) }}</span>
        </p>
      </div>

      <!-- Status message -->
      <div v-if="command.message" class="mb-4 text-sm text-gray-700 dark:text-gray-300">
        <p class="mb-1 font-medium">
          {{ t('component.sync_command.current_state') }}
        </p>
        <p>
          {{ command.message }}
          <template v-if="currentTaskInfo">
            <span class="text-blue-600 font-medium dark:text-blue-400">
              ({{ formatNumberToReadable(currentTaskInfo.current) }} / {{ formatNumberToReadable(currentTaskInfo.total) }} {{ t('component.sync_command.chats') }})
            </span>
          </template>
        </p>
      </div>

      <!-- Sync details -->
      <div v-if="syncDetails" class="mt-6 space-y-4">
        <h3 class="text-gray-800 font-medium dark:text-gray-200">
          {{ t('component.sync_command.sync_detail') }}
        </h3>

        <!-- All Chats Status -->
        <div class="rounded-md bg-gray-50 p-4 dark:bg-gray-700/50">
          <div class="mb-2 text-sm text-gray-700 font-medium dark:text-gray-300">
            {{ t('component.sync_command.all_chats_status') }}
          </div>
          <div class="space-y-3">
            <div v-for="chat in allChats" :key="chat.chatId" class="text-sm">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-2">
                  <Icon
                    :icon="chat.status === 'running' ? 'lucide:loader' : chat.status === 'completed' ? 'lucide:check' : chat.status === 'failed' ? 'lucide:x' : 'lucide:clock'"
                    class="h-4 w-4" :class="[
                      chat.status === 'running' ? 'text-blue-500 animate-spin'
                      : chat.status === 'completed' ? 'text-green-500'
                        : chat.status === 'failed' ? 'text-red-500' : 'text-gray-400',
                    ]"
                  />
                  <span class="text-gray-600 dark:text-gray-300">ID: {{ chat.chatId }}</span>
                </div>
                <div class="flex items-center space-x-4">
                  <span class="text-xs text-gray-500 dark:text-gray-400">
                    {{ formatNumberToReadable(chat.processedMessages || 0) }}/{{ formatNumberToReadable(chat.totalMessages || 0) }}
                  </span>
                  <span class="w-12 text-right font-medium">{{ chat.progress }}%</span>
                </div>
              </div>
              <div v-if="chat.status === 'running'" class="mt-1">
                <div class="h-1 w-full rounded-full bg-gray-200 dark:bg-gray-600">
                  <div
                    class="h-full rounded-full bg-blue-500 transition-all duration-300"
                    :style="{ width: `${chat.progress}%` }"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Task progress -->
        <div class="rounded-md bg-gray-50 p-4 dark:bg-gray-700/50">
          <div class="mb-2 text-sm text-gray-700 font-medium dark:text-gray-300">
            {{ t('component.sync_command.task_progress') }}
          </div>
          <div class="text-sm space-y-3">
            <div v-if="currentTaskInfo" class="flex items-center justify-between">
              <span class="text-gray-600 dark:text-gray-300">{{ t('component.sync_command.processed_chats') }}</span>
              <span class="flex items-center font-medium">
                {{ formatNumberToReadable(currentTaskInfo.current) }}
                <span class="mx-1">/</span>
                {{ formatNumberToReadable(currentTaskInfo.total) }}
              </span>
            </div>

            <div v-if="syncDetails.type" class="flex items-center justify-between">
              <span class="text-gray-600 dark:text-gray-300">{{ t('component.sync_command.sync_type') }}</span>
              <span class="font-medium capitalize">{{ syncDetails.type }}</span>
            </div>

            <div v-if="currentChatInfo" class="flex items-center justify-between">
              <span class="text-gray-600 dark:text-gray-300">{{ t('component.sync_command.current_chat') }}</span>
              <span class="font-medium">{{ currentChatInfo.chatId }}</span>
            </div>
          </div>
        </div>

        <!-- Current Chat Details -->
        <div v-if="currentChatInfo && syncDetails.type === 'messages'" class="rounded-md bg-gray-50 p-4 dark:bg-gray-700/50">
          <div class="mb-2 text-sm text-gray-700 font-medium dark:text-gray-300">
            {{ t('component.sync_command.current_chat_detail') }}
          </div>
          <div class="text-sm space-y-3">
            <div v-if="currentChatInfo.totalMessages" class="flex items-center justify-between">
              <span class="text-gray-600 dark:text-gray-300">{{ t('component.sync_command.total_messages') }}</span>
              <span class="font-medium">{{ formatNumberToReadable(currentChatInfo.totalMessages) }}</span>
            </div>

            <div v-if="currentChatInfo.processedMessages" class="flex items-center justify-between">
              <span class="text-gray-600 dark:text-gray-300">{{ t('component.sync_command.processed_messages') }}</span>
              <span class="flex items-center font-medium">
                {{ formatNumberToReadable(currentChatInfo.processedMessages) }}
                <template v-if="currentChatInfo.totalMessages">
                  <span class="mx-1">/</span>
                  {{ formatNumberToReadable(currentChatInfo.totalMessages) }}
                </template>
              </span>
            </div>

            <div v-if="currentChatInfo.failedMessages" class="flex items-center justify-between text-red-600 dark:text-red-400">
              <span>{{ t('component.sync_command.failed_messages') }}</span>
              <span class="font-medium">{{ formatNumberToReadable(currentChatInfo.failedMessages) }}</span>
            </div>
          </div>
        </div>

        <!-- Chat Status Summary -->
        <div class="rounded-md bg-gray-50 p-4 dark:bg-gray-700/50">
          <div class="mb-2 text-sm text-gray-700 font-medium dark:text-gray-300">
            {{ t('component.sync_command.chat_status_summary') }}
          </div>
          <div class="text-sm space-y-3">
            <div class="grid grid-cols-2 gap-4">
              <div v-for="status in ['pending', 'running', 'completed', 'failed']" :key="status" class="flex items-center justify-between">
                <span class="text-gray-600 capitalize dark:text-gray-300">{{ status }}</span>
                <span class="font-medium">{{ chatStatuses.filter(chat => chat.status === status).length }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Failed Chats -->
        <div v-if="hasFailedChats" class="mt-4 animate-fade-in rounded-md bg-red-50 p-4 text-red-700 dark:bg-red-900/50 dark:text-red-100">
          <p class="mb-2 font-medium">
            {{ t('component.sync_command.failed_chats') }}
          </p>
          <div class="space-y-2">
            <div v-for="chat in failedChats" :key="chat.chatId" class="text-sm">
              <div class="flex items-center justify-between">
                <span>{{ t('component.sync_command.chat_id') }}: {{ chat.chatId }}</span>
                <span v-if="chat.error" class="text-xs">
                  {{ typeof chat.error === 'string' ? chat.error : chat.error.message }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Completion message -->
      <div
        v-if="command.status === 'completed'"
        class="mt-5 animate-fade-in rounded-md bg-green-50 p-3 text-green-700 dark:bg-green-900/50 dark:text-green-100"
      >
        <p class="flex items-center">
          <span class="mr-2 text-lg">✓</span>
          <span>{{ t('component.sync_command.sync_success') }}</span>
        </p>
      </div>
    </div>
  </div>
</template>
