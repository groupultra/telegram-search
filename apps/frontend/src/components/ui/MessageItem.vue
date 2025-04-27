<script setup lang="ts">
import type { MessageProps } from '../../types/message-props'

defineProps<MessageProps>()
</script>

<template>
  <div class="flex items-start gap-4 p-3 hover:bg-gray-50 transition-all duration-200 rounded-lg">
    <div class="bg-muted mt-1 h-9 w-9 flex items-center justify-center overflow-hidden">
      <img :src="`https://api.dicebear.com/6.x/bottts/svg?seed=${sender}`" alt="User" class="h-full w-full object-cover">
    </div>
    <div class="flex-1">
      <div class="flex items-center gap-2 mb-1">
        <span class="font-medium text-gray-900">{{ sender }}</span>
        <span class="text-gray-500 text-xs">{{ timestamp }}</span>
      </div>
      <div class="text-gray-700">
        <slot />
      </div>
    </div>
  </div>
</template>
