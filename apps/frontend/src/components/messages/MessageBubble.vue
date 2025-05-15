<script setup lang="ts">
import type { CoreMessage } from '@tg-search/core'

import Avatar from '../ui/Avatar.vue'

defineProps<{
  message: CoreMessage
}>()
</script>

<template>
  <div class="flex items-start gap-4 rounded-lg p-3 transition-all duration-200 hover:bg-muted">
    <div class="mt-1">
      <Avatar
        :name="message.fromName"
        size="md"
      />
    </div>
    <div class="flex-1">
      <div class="mb-1 flex items-center gap-2">
        <span class="font-medium text-primary whitespace-nowrap">{{ message.fromName }}</span>
        <span class="text-xs text-secondary-foreground whitespace-nowrap">{{ message.createdAt }}</span>
      </div>
      <div class="text-foreground">
        {{ message.content }}
      </div>
    </div>
  </div>
</template>
