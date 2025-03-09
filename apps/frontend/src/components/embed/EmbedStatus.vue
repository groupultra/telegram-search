<!-- Embed status component -->
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
  command: Command
  progress: number
  waitingTimeLeft?: number
}>()

const { t } = useI18n()
const { statusText, statusIcon } = useStatus(props.command)

const isWaiting = computed(() => props.command?.status === 'waiting')

// Embed details from metadata
const embedDetails = computed(() => {
  if (!props.command || !props.command.metadata) {
    return null
  }

  const metadata = props.command.metadata
  return {
    totalMessages: metadata.totalMessages as number,
    processedMessages: metadata.processedMessages as number,
    failedMessages: metadata.failedMessages as number,
    currentBatch: metadata.currentBatch as number,
    totalBatches: metadata.totalBatches as number,
    error: metadata.error as string | { name: string, message: string, stack?: string },
  }
})

// Helper computed properties
const processedPercentage = computed(() => {
  if (!embedDetails.value?.totalMessages)
    return 0
  return Math.round((embedDetails.value.processedMessages / embedDetails.value.totalMessages) * 100)
})

const batchProgress = computed(() => {
  if (!embedDetails.value?.totalBatches)
    return 0
  return Math.round((embedDetails.value.currentBatch / embedDetails.value.totalBatches) * 100)
})

const hasError = computed(() => {
  return embedDetails.value?.error != null
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
          <span class="mr-2">{{ t('component.embed_command.embed_status') }}</span>
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
          <span class="text-gray-600 dark:text-gray-300">{{ t('component.embed_command.overall_progress') }}</span>
          <span class="font-medium">{{ progress }}%</span>
        </div>
        <ProgressBar
          :progress="progress"
          :status="command.status"
        />
        <div class="mt-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{{ t('component.embed_command.messages') }}: {{ formatNumberToReadable(embedDetails?.processedMessages || 0) }}/{{ formatNumberToReadable(embedDetails?.totalMessages || 0) }}</span>
          <span>{{ t('component.embed_command.batches') }}: {{ embedDetails?.currentBatch || 0 }}/{{ embedDetails?.totalBatches || 0 }}</span>
        </div>
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
          {{ t('component.embed_command.current_state') }}
        </p>
        <p>{{ command.message }}</p>
      </div>

      <!-- Embed details -->
      <div v-if="embedDetails" class="mt-6 space-y-4">
        <h3 class="text-gray-800 font-medium dark:text-gray-200">
          {{ t('component.embed_command.embed_detail') }}
        </h3>

        <!-- Progress Details -->
        <div class="rounded-md bg-gray-50 p-4 dark:bg-gray-700/50">
          <div class="text-sm space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-gray-600 dark:text-gray-300">{{ t('component.embed_command.total_messages') }}</span>
              <span class="font-medium">{{ formatNumberToReadable(embedDetails.totalMessages) }}</span>
            </div>

            <div class="flex items-center justify-between">
              <span class="text-gray-600 dark:text-gray-300">{{ t('component.embed_command.processed_messages') }}</span>
              <span class="flex items-center font-medium">
                {{ formatNumberToReadable(embedDetails.processedMessages) }}
                <span class="mx-1">/</span>
                {{ formatNumberToReadable(embedDetails.totalMessages) }}
                <span class="ml-2 text-xs text-gray-500">({{ processedPercentage }}%)</span>
              </span>
            </div>

            <div v-if="embedDetails.failedMessages > 0" class="flex items-center justify-between text-red-600 dark:text-red-400">
              <span>{{ t('component.embed_command.failed_messages') }}</span>
              <span class="font-medium">{{ formatNumberToReadable(embedDetails.failedMessages) }}</span>
            </div>

            <div class="flex items-center justify-between">
              <span class="text-gray-600 dark:text-gray-300">{{ t('component.embed_command.current_batch') }}</span>
              <span class="flex items-center font-medium">
                {{ embedDetails.currentBatch }}
                <span class="mx-1">/</span>
                {{ embedDetails.totalBatches }}
                <span class="ml-2 text-xs text-gray-500">({{ batchProgress }}%)</span>
              </span>
            </div>
          </div>
        </div>

        <!-- Error Details -->
        <div v-if="hasError" class="animate-fade-in rounded-md bg-red-50 p-4 text-red-700 dark:bg-red-900/50 dark:text-red-100">
          <p class="mb-2 font-medium">
            {{ t('component.embed_command.error_details') }}
          </p>
          <div class="text-sm">
            <template v-if="typeof embedDetails.error === 'string'">
              {{ embedDetails.error }}
            </template>
            <template v-else>
              <p class="font-medium">
                {{ embedDetails.error.name }}
              </p>
              <p>{{ embedDetails.error.message }}</p>
            </template>
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
          <span>{{ t('component.embed_command.embed_success') }}</span>
        </p>
      </div>
    </div>
  </div>
</template>
