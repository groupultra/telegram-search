<script setup lang="ts">
import TextMessage from './TextMessage.vue'

defineProps<{
  text: string
}>()
</script>

<template>
  <div class="flex flex-col items-start gap-2">
    <TextMessage :text="text" />
    <div class="inline-flex px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700">
      <slot />
    </div>
  </div>
</template>
