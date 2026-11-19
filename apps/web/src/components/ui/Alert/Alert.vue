<script setup lang="ts">
import { cn } from '@/lib/utils'

type AlertType = 'error' | 'warning' | 'info'

const props = withDefaults(defineProps<{
  type?: AlertType
  class?: string
}>(), {
  type: 'error',
})

const TYPE_CLASS: Record<AlertType, string> = {
  error: 'bg-destructive/12 text-destructive',
  warning: 'bg-warning/16 text-fg',
  info: 'bg-fill-3 text-fg-2',
}

const TYPE_ICON_CLASS: Record<AlertType, string> = {
  error: 'i-lucide-circle-alert',
  warning: 'i-lucide-triangle-alert',
  info: 'i-lucide-info',
}
</script>

<template>
  <div role="alert" :class="cn('flex items-start gap-2 rounded-md px-3 py-2 text-sm leading-5', TYPE_CLASS[type], props.class)">
    <span :class="cn(TYPE_ICON_CLASS[type], 'mt-0.5 h-4 w-4 shrink-0')" />
    <div class="min-w-0 flex-1">
      <slot />
    </div>
  </div>
</template>
