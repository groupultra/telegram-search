<script setup lang="ts">
import { cn } from '@/lib/utils'

type TagColor = 'default' | 'primary' | 'success' | 'warning' | 'danger'

const props = withDefaults(defineProps<{
  color?: TagColor
  size?: 'sm' | 'md'
  icon?: string
  class?: string
}>(), {
  color: 'default',
  size: 'md',
})

const COLOR_CLASS: Record<TagColor, string> = {
  default: 'bg-fill-3 text-fg-2',
  primary: 'bg-primary text-primary-foreground',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/16 text-warning',
  danger: 'bg-destructive/12 text-destructive',
}
</script>

<template>
  <span
    :class="cn(
      'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xs text-xs leading-none',
      size === 'sm' ? 'h-5 px-1.5' : 'h-5.5 px-2',
      COLOR_CLASS[color],
      props.class,
    )"
  >
    <span v-if="icon" :class="cn(icon, 'h-3 w-3')" />
    <slot />
  </span>
</template>
