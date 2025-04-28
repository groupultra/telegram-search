<script setup lang="ts">
defineProps<{
  text: string
}>()
</script>

<template>
  <button class="w-full flex items-center gap-3 rounded-md px-3 py-1 text-sm text-foreground transition-colors hover:bg-muted">
    <div class="h-6 w-6 flex items-center justify-center overflow-hidden rounded-full">
      <slot />
    </div>
    <span class="select-none">{{ text }}</span>
  </button>
</template>
