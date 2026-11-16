<script setup lang="ts">
import type { PopoverContentProps } from 'reka-ui'

import { PopoverContent, PopoverPortal } from 'reka-ui'
import { computed } from 'vue'

import { cn } from '@/lib/utils'

import { POPUP_SURFACE_CLASS } from '../styles'

const props = withDefaults(defineProps<PopoverContentProps & { class?: string }>(), {
  sideOffset: 8,
})

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  void _
  return delegated
})
</script>

<template>
  <PopoverPortal>
    <PopoverContent
      v-bind="delegatedProps"
      :class="cn(POPUP_SURFACE_CLASS, 'min-w-[7.5rem] p-3', props.class)"
    >
      <slot />
    </PopoverContent>
  </PopoverPortal>
</template>
