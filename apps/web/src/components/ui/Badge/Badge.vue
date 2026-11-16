<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{
  count: number
  max?: number
  class?: string
}>(), {
  max: 99,
})

const label = computed(() => props.count > props.max ? `${props.max}+` : String(props.count))
</script>

<template>
  <span
    v-if="count > 0"
    :class="cn(
      'h-4.5 min-w-4.5 inline-flex shrink-0 items-center justify-center rounded-full bg-primary px-1.25 text-[11px] text-primary-foreground font-medium leading-none',
      props.class,
    )"
  >
    {{ label }}
  </span>
</template>
