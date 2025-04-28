<script setup lang="ts">
import TextMessage from './TextMessage.vue'

defineProps<{
  text: string
}>()
</script>

<template>
  <div class="flex flex-col items-start gap-2">
    <TextMessage :text="text" />
    <div class="inline-flex border border-gray-100 rounded-lg bg-gray-50 px-3 py-2 transition-all duration-200 dark:border-gray-700 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700">
      <slot />
    </div>
  </div>
</template>
