<script setup lang="ts">
import type { CoreMessage } from '@tg-search/core/types'

import { computed } from 'vue'

import Avatar from '../ui/Avatar.vue'
import MediaRenderer from './media/MediaRenderer.vue'

const props = defineProps<{
  message: CoreMessage
}>()

const formattedTimestamp = computed(() => {
  if (!props.message.platformTimestamp)
    return ''
  return new Date(props.message.platformTimestamp * 1000).toLocaleString()
})
</script>

<template>
  <div class="flex items-start gap-4 rounded-lg p-3 transition-all duration-200 hover:bg-neutral-100 dark:hover:bg-gray-800">
    <div class="mt-1">
      <Avatar
        :name="message.fromName"
        size="md"
      />
    </div>
    <div class="flex-1">
      <div class="mb-1 flex items-center gap-2">
        <span class="whitespace-nowrap text-gray-900 text-primary font-medium dark:text-gray-100">{{ message.fromName }}</span>
        <span class="whitespace-nowrap text-xs text-gray-600 dark:text-gray-400">{{ formattedTimestamp }}</span>
        <span class="whitespace-nowrap text-xs text-gray-600 dark:text-gray-400">{{ message.platformMessageId }}</span>
      </div>

      <div class="text-gray-900 dark:text-gray-100">
        <MediaRenderer :message="message" />
      </div>
    </div>
  </div>
</template>
