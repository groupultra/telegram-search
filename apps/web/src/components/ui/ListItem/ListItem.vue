<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'

import { Primitive } from 'reka-ui'

import { cn } from '@/lib/utils'

import { LIST_ITEM_ACTIVE_CLASS, LIST_ITEM_CLASS } from '../styles'

interface Props extends PrimitiveProps {
  active?: boolean
  icon?: string
  /** Second line under the label. Makes the row taller. */
  description?: string
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  as: 'button',
})
</script>

<template>
  <Primitive
    :as="as"
    :as-child="asChild"
    :type="as === 'button' ? 'button' : undefined"
    :class="cn(
      LIST_ITEM_CLASS,
      description ? 'min-h-11 py-1.5' : 'min-h-8 py-1.5',
      active ? LIST_ITEM_ACTIVE_CLASS : '',
      props.class,
    )"
  >
    <slot name="prefix">
      <span v-if="icon" :class="cn(icon, 'h-4 w-4 shrink-0')" />
    </slot>
    <span class="min-w-0 flex flex-1 flex-col">
      <span class="truncate leading-5"><slot /></span>
      <span v-if="description" class="truncate text-xs text-fg-3 font-normal leading-4">{{ description }}</span>
    </span>
    <slot name="suffix" />
  </Primitive>
</template>
