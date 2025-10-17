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
  <div class="group hover:bg-accent/50 mx-3 my-1 flex items-start gap-3 rounded-xl p-3 transition-all duration-200 md:mx-4 md:gap-4">
    <div class="flex-shrink-0 pt-0.5">
      <Avatar
        :name="message.fromName"
        size="md"
      />
    </div>
    <div class="min-w-0 flex-1">
      <div class="mb-1.5 flex items-baseline gap-2">
        <span class="text-foreground truncate text-sm font-semibold">{{ message.fromName }}</span>
        <span class="text-muted-foreground flex-shrink-0 text-xs">{{ formattedTimestamp }}</span>
      </div>

      <div class="prose prose-sm text-foreground/90 max-w-none">
        <MediaRenderer :message="message" />
      </div>

      <!-- Message ID badge (hidden by default, shown on hover) -->
      <div class="mt-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        <span class="bg-muted text-muted-foreground inline-flex items-center rounded-md px-2 py-0.5 text-xs">
          <span class="i-lucide-hash mr-1 h-3 w-3" />
          {{ message.platformMessageId }}
        </span>
      </div>
    </div>
  </div>
</template>
