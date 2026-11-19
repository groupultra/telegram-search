<script setup lang="ts">
import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{
  label: string
  description?: string
  for?: string
  /** `horizontal` puts a compact control (switch, short input) at the end of the row. */
  layout?: 'vertical' | 'horizontal'
  class?: string
}>(), {
  layout: 'vertical',
})
</script>

<template>
  <div
    :class="cn(
      layout === 'horizontal' ? 'min-h-8 flex items-center justify-between gap-4' : 'flex flex-col gap-1.5',
      props.class,
    )"
  >
    <div class="min-w-0 flex flex-col gap-0.5">
      <label :for="props.for" class="text-sm text-fg leading-5" :class="layout === 'vertical' ? 'text-[13px] text-fg-2' : ''">{{ label }}</label>
      <p v-if="description" class="text-xs text-fg-3 leading-4">
        {{ description }}
      </p>
    </div>
    <div :class="layout === 'horizontal' ? 'shrink-0' : 'min-w-0'">
      <slot />
    </div>
  </div>
</template>
