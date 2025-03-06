<!-- Sync status component -->
<script setup lang="ts">
import type { Command } from '@tg-search/server'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useStatus } from '../../composables/useStatus'
import { formatNumberToReadable } from '../../helper'
import ProgressBar from '../ui/ProgressBar.vue'
import StatusBadge from '../ui/StatusBadge.vue'

const props = defineProps<{
  command: Command | null
  progress: number
  waitingTimeLeft?: number
}>()

const { t } = useI18n()
const { statusText, statusIcon } = useStatus(props.command?.status || 'waiting')

const commandStatus = computed((): 'waiting' | 'running' | 'completed' | 'failed' => {
  if (!props.command)
    return 'waiting'
  return props.command.status as any
})

const isWaiting = computed(() => props.command?.status === 'waiting')
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
          :status="commandStatus"
          :label="statusText"
          :icon="statusIcon"
        />
      </div>

      <!-- Progress bar -->
      <div class="mb-5">
        <ProgressBar
          :progress="progress"
          :status="commandStatus"
        />
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
        <p>{{ command.message }}</p>
      </div>

      <!-- Sync details -->
      <div v-if="command.metadata" class="mt-6 space-y-4">
        <h3 class="text-gray-800 font-medium dark:text-gray-200">
          {{ t('component.sync_command.sync_detail') }}
        </h3>

        <!-- 文件夹同步状态 -->
        <div v-if="command.metadata?.totalFolders || command.metadata?.processedFolders" class="rounded-md bg-gray-50 p-4 dark:bg-gray-700/50">
          <div class="mb-2 text-sm text-gray-700 font-medium dark:text-gray-300">
            {{ t('component.sync_command.folder_sync_status') }}
          </div>
          <div class="text-sm space-y-3">
            <div v-if="command.metadata?.totalFolders" class="flex items-center justify-between">
              <span class="text-gray-600 dark:text-gray-300">{{ t('component.sync_command.total_folders') }}</span>
              <span class="font-medium">{{ formatNumberToReadable(Number(command.metadata.totalFolders)) }}</span>
            </div>

            <div v-if="command.metadata?.processedFolders" class="flex items-center justify-between">
              <span class="text-gray-600 dark:text-gray-300">{{ t('component.sync_command.processed_folders') }}</span>
              <span class="flex items-center font-medium">
                {{ formatNumberToReadable(Number(command.metadata.processedFolders)) }}
                <template v-if="command.metadata?.totalFolders">
                  <span class="mx-1">/</span> {{ formatNumberToReadable(Number(command.metadata.totalFolders)) }}
                </template>
              </span>
            </div>

            <div v-if="command.metadata?.failedFolders" class="flex items-center justify-between text-red-600 dark:text-red-400">
              <span>{{ t('component.sync_command.failed_folders') }}</span>
              <span class="font-medium">{{ formatNumberToReadable(Number(command.metadata.failedFolders)) }}</span>
            </div>
          </div>
        </div>

        <!-- 会话同步状态 -->
        <div v-if="command.metadata?.totalChats || command.metadata?.processedChats" class="rounded-md bg-gray-50 p-4 dark:bg-gray-700/50">
          <div class="mb-2 text-sm text-gray-700 font-medium dark:text-gray-300">
            {{ t('component.sync_command.chat_sync_status') }}
          </div>
          <div class="text-sm space-y-3">
            <div v-if="command.metadata?.totalChats" class="flex items-center justify-between">
              <span class="text-gray-600 dark:text-gray-300">{{ t('component.sync_command.total_chats') }}</span>
              <span class="font-medium">{{ formatNumberToReadable(Number(command.metadata.totalChats)) }}</span>
            </div>

            <div v-if="command.metadata?.processedChats" class="flex items-center justify-between">
              <span class="text-gray-600 dark:text-gray-300">{{ t('component.sync_command.processed_chats') }}</span>
              <span class="flex items-center font-medium">
                {{ formatNumberToReadable(Number(command.metadata.processedChats)) }}
                <template v-if="command.metadata?.totalChats">
                  <span class="mx-1">/</span> {{ formatNumberToReadable(Number(command.metadata.totalChats)) }}
                </template>
              </span>
            </div>

            <div v-if="command.metadata?.failedChats" class="flex items-center justify-between text-red-600 dark:text-red-400">
              <span>{{ t('component.sync_command.failed_chats') }}</span>
              <span class="font-medium">{{ formatNumberToReadable(Number(command.metadata.failedChats)) }}</span>
            </div>
          </div>
        </div>

        <!-- Error message -->
        <div v-if="command.error" class="mt-4 animate-fade-in rounded-md bg-red-50 p-4 text-red-700 dark:bg-red-900/50 dark:text-red-100">
          <p class="mb-2 font-medium">
            {{ t('component.sync_command.error_message') }}
          </p>
          <div v-if="typeof command.error === 'string'" class="text-sm">
            {{ command.error }}
          </div>
          <div v-else class="text-sm">
            <div>{{ command.error.name }}: {{ command.error.message }}</div>
            <pre v-if="command.error.stack" class="mt-3 overflow-auto rounded-md bg-red-100 p-2 text-xs dark:bg-red-900/50">{{ command.error.stack }}</pre>
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
