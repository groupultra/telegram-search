<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <header class="h-14 flex shrink-0 items-center justify-between gap-3 border-b bg-background px-4 md:px-6">
    <div class="min-w-0 flex items-baseline gap-3">
      <h1 class="shrink-0 text-base font-semibold tracking-tight">
        {{ title }}
      </h1>
      <p v-if="description" class="truncate text-xs text-muted-foreground hidden lg:block">
        {{ description }}
      </p>
    </div>

    <div class="min-w-0 flex items-center gap-2">
      <slot />
    </div>
  </header>
</template>
