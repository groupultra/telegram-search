<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <header class="h-14 flex shrink-0 items-center justify-between gap-3 border-b border-line-2 bg-container px-4">
    <div class="min-w-0 flex items-baseline gap-3">
      <h1 class="shrink-0 text-base text-fg font-semibold leading-6">
        {{ title }}
      </h1>
      <p v-if="description" class="truncate text-xs text-fg-3 hidden lg:block">
        {{ description }}
      </p>
    </div>

    <div class="min-w-0 flex items-center gap-2">
      <slot />
    </div>
  </header>
</template>
