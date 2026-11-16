<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'

import type { ControlSize } from '../styles'

import { Primitive } from 'reka-ui'

import { cn } from '@/lib/utils'

import { CONTROL_TRANSITION, ICON_CONTROL_SIZE_CLASS, ICON_GLYPH_SIZE_CLASS } from '../styles'
import { Tooltip } from '../Tooltip'

interface Props extends PrimitiveProps {
  /** Icon class, e.g. `i-lucide-search`. */
  icon: string
  /** Accessible name; also shown as a tooltip. */
  title?: string
  size?: ControlSize
  /** Pressed/selected state, e.g. the current navigation entry. */
  active?: boolean
  danger?: boolean
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left'
  class?: string
}

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<Props>(), {
  as: 'button',
  size: 'md',
})
</script>

<template>
  <Tooltip :content="title" :side="tooltipSide" v-bind="$attrs">
    <Primitive
      :as="as"
      :as-child="asChild"
      :type="as === 'button' ? 'button' : undefined"
      :aria-label="title"
      :class="cn(
        'inline-flex shrink-0 select-none items-center justify-center text-fg-3 disabled:cursor-not-allowed disabled:opacity-50',
        CONTROL_TRANSITION,
        ICON_CONTROL_SIZE_CLASS[size],
        danger ? 'hover:bg-destructive/12 hover:text-destructive' : 'hover:bg-fill-2 hover:text-fg-2 active:text-fg',
        active ? 'bg-fill-2 text-fg!' : '',
        props.class,
      )"
    >
      <span :class="cn(icon, ICON_GLYPH_SIZE_CLASS[size])" />
      <slot />
    </Primitive>
  </Tooltip>
</template>
