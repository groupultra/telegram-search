<script setup lang="ts">
import type { CoreMessage } from '@tg-search/core'

defineProps<{
  message: CoreMessage
}>()
</script>

<template>
  <div class="flex items-start gap-4 rounded-lg p-3 transition-all duration-200 hover:bg-muted">
    <div class="mt-1 h-9 w-9 flex items-center justify-center overflow-hidden">
      <img :src="`https://api.dicebear.com/6.x/bottts/svg?seed=${message.fromId}`" alt="User" class="h-full w-full object-cover">
    </div>
    <div class="flex-1">
      <div class="mb-1 flex items-center gap-2">
        <span class="font-medium text-primary">{{ message.fromName }}</span>
        <span class="text-xs text-secondary-foreground">{{ message.createdAt }}</span>
      </div>
      <div class="text-foreground">
        {{ message.content }}
      </div>
    </div>
  </div>
</template>
