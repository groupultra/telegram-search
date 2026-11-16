<script setup lang="ts">
import { cn } from '@/lib/utils'

type StatisticTone = 'default' | 'muted' | 'danger'

const props = withDefaults(defineProps<{
  label: string
  value: string | number
  tone?: StatisticTone
  class?: string
}>(), {
  tone: 'default',
})

const TONE_CLASS: Record<StatisticTone, string> = {
  default: 'text-fg',
  muted: 'text-fg-3',
  danger: 'text-destructive',
}
</script>

<template>
  <div :class="cn('min-w-0 flex flex-col gap-1.5 rounded-md bg-fill-3 px-3 py-2.5', props.class)">
    <span class="truncate eyebrow">{{ label }}</span>
    <span :class="cn('truncate text-xl font-semibold leading-7', TONE_CLASS[tone])">{{ value }}</span>
  </div>
</template>
