<script setup lang="ts">
defineProps<{
  text: string
}>()
</script>

<template>
  <button class="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm">
    <div class="h-6 w-6 flex items-center justify-center overflow-hidden rounded-full">
        <slot/>
    </div>
    <span>{{ text }}</span>
  </button>
</template>
