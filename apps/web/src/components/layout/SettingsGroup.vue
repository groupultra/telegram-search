<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  icon?: string
}>()
</script>

<template>
  <!-- A titled block of related settings: an outlined container under a heading. -->
  <section class="flex flex-col gap-3">
    <div class="flex items-center gap-2.5 px-1">
      <span v-if="icon" :class="icon" class="h-4 w-4 shrink-0 text-fg-2" />
      <div class="min-w-0">
        <h3 class="text-sm text-fg font-semibold leading-5">
          {{ title }}
        </h3>
        <p v-if="description" class="text-xs text-fg-3 leading-4">
          {{ description }}
        </p>
      </div>
    </div>
    <div class="flex flex-col gap-4 rounded-lg bg-container p-4 shadow-[inset_0_0_0_1px_hsl(var(--line-secondary))] dark:bg-fill-4">
      <slot />
    </div>
  </section>
</template>
