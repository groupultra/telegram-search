<script setup lang="ts">
import { cn } from '@/lib/utils'

const props = defineProps<{
  icon?: string
  title?: string
  description?: string
  class?: string
}>()
</script>

<template>
  <div :class="cn('h-full w-full flex flex-col items-center justify-center gap-1 px-4 py-8 text-center', props.class)">
    <span v-if="icon" :class="cn(icon, 'mb-2 h-8 w-8 text-fg-4')" />
    <p v-if="title" class="text-sm text-fg-2 font-medium">
      {{ title }}
    </p>
    <p v-if="description" class="max-w-sm text-xs text-fg-3">
      {{ description }}
    </p>
    <div v-if="$slots.default" class="mt-3">
      <slot />
    </div>
  </div>
</template>
