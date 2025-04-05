<!-- Export status component -->
<script setup lang="ts">
import type { Command, ExportDetails } from '@tg-search/server'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useStatus } from '../../composables/useStatus'
import { formatNumberToReadable, formatSpeedToReadable, formatTimeToReadable } from '../../helper'
import ProgressBar from '../ui/ProgressBar.vue'
import StatusBadge from '../ui/StatusBadge.vue'

const props = defineProps<{
  command: Command
  progress: number
  waitingTimeLeft?: number
  estimatedTimeLeft?: number | null
}>()

const { t } = useI18n()
const { statusText, statusIcon } = useStatus(props.command)

const isWaiting = computed(() => props.command?.status === 'waiting')

const exportDetails = computed(() => {
  if (!props.command || !props.command.metadata) {
    return null
  }

  const metadata = props.command.metadata

  return {
    totalMessages: metadata.totalMessages as number | undefined,
    processedMessages: metadata.processedMessages as number | undefined,
    failedMessages: metadata.failedMessages as number | undefined,
    totalDuration: metadata.totalDuration as number | undefined,
    estimatedTimeRemaining: metadata.estimatedTimeRemaining as number | undefined,
    currentSpeed: metadata.currentSpeed as number | undefined,
    currentBatch: metadata.currentBatch as number | undefined,
    totalBatches: metadata.totalBatches as number | undefined,
    error: metadata.error,
  } as ExportDetails
})

const totalMessages = computed(() => {
  return exportDetails.value?.totalMessages
})

const processedMessages = computed(() => {
  return exportDetails.value?.processedMessages
})

const estimatedTimeRemaining = computed(() => {
  if (exportDetails.value?.estimatedTimeRemaining) {
    return formatTimeToReadable(exportDetails.value.estimatedTimeRemaining)
  }
  if (props.estimatedTimeLeft) {
    return formatTimeToReadable(props.estimatedTimeLeft)
  }
  return null
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
          <span class="mr-2">{{ t('component.export_command.export_status') }}</span>
          <span
            v-if="command.status === 'running'"
            class="inline-block animate-spin text-yellow-500"
          >⟳</span>
        </h2>
        <StatusBadge
          :status="command.status"
          :label="statusText"
          :icon="statusIcon"
        />
      </div>

      <!-- Progress bar -->
      <div class="mb-5">
        <ProgressBar
          :progress="progress"
          :status="command.status"
        />
      </div>

      <!-- 等待提示 -->
      <div v-if="isWaiting" class="mb-5 animate-fade-in rounded-md bg-yellow-50 p-3 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
        <p class="flex items-center">
          <span class="mr-2 text-lg">
            <i icon="lucide:clock" />
          </span>
          <span>{{ t('component.export_command.telegram_limit', { waitingTimeLeft }) }}</span>
        </p>
      </div>

      <!-- Status message -->
      <div v-if="command.message" class="mb-4 text-sm text-gray-700 dark:text-gray-300">
        <p class="mb-1 font-medium">
          {{ t('component.export_command.current_state') }}
        </p>
        <p>
          {{ command.message }}
          <template v-if="command.message?.includes('已处理')">
            <span
              v-if="!!totalMessages && !!processedMessages"
              class="text-blue-600 font-medium dark:text-blue-400"
            >
              ({{ formatNumberToReadable(processedMessages) }} / {{ formatNumberToReadable(totalMessages) }} {{ t('component.export_command.item') }})
            </span>
            <span
              v-else-if="exportDetails?.totalMessages"
              class="text-blue-600 font-medium dark:text-blue-400"
            >
              ({{ t('component.export_command.total') }} {{ formatNumberToReadable(exportDetails.totalMessages) }} {{ t('component.export_command.item') }})
            </span>
          </template>
        </p>
      </div>

      <!-- Export details -->
      <div v-if="exportDetails" class="mt-6 space-y-4">
        <h3 class="text-gray-800 font-medium dark:text-gray-200">
          {{ t('component.export_command.export_detail') }}
        </h3>

        <div class="rounded-md bg-gray-50 p-4 dark:bg-gray-700/50">
          <div class="text-sm space-y-3">
            <div v-if="exportDetails.totalMessages !== undefined" class="flex items-center justify-between">
              <span class="text-gray-600 dark:text-gray-300">{{ t('component.export_command.total_message') }}</span>
              <span class="font-medium">{{ formatNumberToReadable(exportDetails.totalMessages) }}</span>
            </div>

            <div v-if="exportDetails.processedMessages !== undefined" class="flex items-center justify-between">
              <span class="text-gray-600 dark:text-gray-300">{{ t('component.export_command.processed_message') }} </span>
              <span class="flex items-center font-medium">
                {{ formatNumberToReadable(exportDetails.processedMessages) }}
                <template v-if="exportDetails.totalMessages !== undefined">
                  <span class="mx-1">/</span> {{ formatNumberToReadable(exportDetails.totalMessages) }}
                </template>
              </span>
            </div>

            <div v-if="exportDetails.failedMessages" class="flex items-center justify-between text-red-600 dark:text-red-400">
              <span>{{ t('component.export_command.failure_message') }}</span>
              <span class="font-medium">{{ formatNumberToReadable(exportDetails.failedMessages) }}</span>
            </div>

            <div v-if="exportDetails.currentBatch && exportDetails.totalBatches" class="flex items-center justify-between">
              <span class="text-gray-600 dark:text-gray-300">{{ t('component.export_command.current_batch') }}</span>
              <span class="font-medium">{{ exportDetails.currentBatch }} / {{ exportDetails.totalBatches }}</span>
            </div>
          </div>
        </div>

        <div v-if="exportDetails.currentSpeed || estimatedTimeRemaining || exportDetails.totalDuration" class="rounded-md bg-gray-50 p-4 dark:bg-gray-700/50">
          <div class="text-sm space-y-3">
            <div v-if="exportDetails.currentSpeed" class="flex items-center justify-between">
              <span class="text-gray-600 dark:text-gray-300">{{ t('component.export_command.current_speed') }}</span>
              <span class="font-medium">{{ formatSpeedToReadable(exportDetails.currentSpeed) }}</span>
            </div>

            <div v-if="estimatedTimeRemaining" class="flex items-center justify-between">
              <span class="text-gray-600 dark:text-gray-300">{{ t('component.export_command.estimated_remaining_time') }}</span>
              <span class="font-medium">{{ estimatedTimeRemaining }}</span>
            </div>

            <div v-if="exportDetails.totalDuration" class="flex items-center justify-between">
              <span class="text-gray-600 dark:text-gray-300">{{ t('component.export_command.total_time') }}</span>
              <span class="font-medium">{{ formatTimeToReadable(exportDetails.totalDuration) }}</span>
            </div>
          </div>
        </div>

        <div v-if="exportDetails.error" class="mt-4 animate-fade-in rounded-md bg-red-50 p-4 text-red-700 dark:bg-red-900/50 dark:text-red-100">
          <p class="mb-2 font-medium">
            {{ t('component.export_command.error_message') }}
          </p>
          <div v-if="typeof exportDetails.error === 'string'" class="text-sm">
            {{ exportDetails.error }}
          </div>
          <div v-else class="text-sm">
            <div>{{ exportDetails.error.name }}: {{ exportDetails.error.message }}</div>
            <pre v-if="exportDetails.error.stack" class="mt-3 overflow-auto rounded-md bg-red-100 p-2 text-xs dark:bg-red-900/50">{{ exportDetails.error.stack }}</pre>
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
          <span>{{ t('component.export_command.export_success') }}</span>
        </p>
      </div>
    </div>
  </div>
</template>
