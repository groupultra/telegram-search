<script setup lang="ts">
import type { SelectContentEmits, SelectContentProps } from 'reka-ui'

import {
  SelectContent,

  SelectPortal,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectViewport,
  useForwardPropsEmits,
} from 'reka-ui'
import { computed } from 'vue'

import { cn } from '@/lib/utils'

import { POPUP_SURFACE_CLASS } from '../styles'

const props = withDefaults(
  defineProps<SelectContentProps & { class?: string }>(),
  {
    position: 'popper',
  },
)
const emits = defineEmits<SelectContentEmits>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <SelectPortal>
    <SelectContent
      v-bind="forwarded"
      :class="cn(
        POPUP_SURFACE_CLASS,
        'relative max-h-96 min-w-[8rem] overflow-hidden',
        position === 'popper'
          && 'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
        props.class,
      )"
    >
      <SelectScrollUpButton class="flex cursor-default items-center justify-center py-1">
        <span class="i-lucide-chevron-up h-4 w-4" />
      </SelectScrollUpButton>

      <SelectViewport :class="cn('p-1', position === 'popper' && 'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]')">
        <slot />
      </SelectViewport>

      <SelectScrollDownButton class="flex cursor-default items-center justify-center py-1">
        <span class="i-lucide-chevron-down h-4 w-4" />
      </SelectScrollDownButton>
    </SelectContent>
  </SelectPortal>
</template>
