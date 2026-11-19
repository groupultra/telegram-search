<script setup lang="ts">
import type { PrimitiveProps } from 'reka-ui'

import type { ControlSize } from '../styles'

import { Primitive } from 'reka-ui'

import { cn } from '@/lib/utils'

import { CONTROL_SIZE_CLASS, CONTROL_TRANSITION, ICON_CONTROL_SIZE_CLASS, ICON_GLYPH_SIZE_CLASS } from '../styles'

type ButtonVariant = 'default' | 'primary' | 'fill' | 'text' | 'danger'

interface Props extends PrimitiveProps {
  /** `default` is outlined; `primary` is the one main action of a view. */
  variant?: ButtonVariant
  size?: ControlSize
  /** Icon class (e.g. `i-lucide-save`) shown before the label. */
  icon?: string
  /** Square button for a single icon. Prefer ActionIcon for toolbar icons. */
  iconOnly?: boolean
  loading?: boolean
  block?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  as: 'button',
  variant: 'default',
  size: 'md',
})

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  default: 'border-line bg-container text-fg hover:border-fg-4 hover:bg-fill-3 active:bg-fill-2 dark:bg-fill-3 dark:hover:bg-fill-2',
  primary: 'border-primary bg-primary text-primary-foreground hover:border-primary-hover hover:bg-primary-hover active:border-primary-active active:bg-primary-active',
  fill: 'border-transparent bg-fill-3 text-fg hover:bg-fill-2 active:bg-fill',
  text: 'border-transparent bg-transparent text-fg hover:bg-fill-2 active:bg-fill',
  danger: 'border-transparent bg-destructive/12 text-destructive hover:bg-destructive/18 active:bg-destructive/22',
}
</script>

<template>
  <Primitive
    :as="as"
    :as-child="asChild"
    :type="as === 'button' ? 'button' : undefined"
    :data-loading="loading || undefined"
    :class="cn(
      'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap border font-medium leading-none disabled:cursor-not-allowed disabled:opacity-50',
      CONTROL_TRANSITION,
      CONTROL_SIZE_CLASS[size],
      iconOnly ? [ICON_CONTROL_SIZE_CLASS[size], 'px-0'] : '',
      VARIANT_CLASS[variant],
      block ? 'w-full' : '',
      loading ? 'pointer-events-none opacity-70' : '',
      props.class,
    )"
  >
    <span v-if="loading" :class="cn('i-lucide-loader-circle animate-spin', ICON_GLYPH_SIZE_CLASS[size])" />
    <span v-else-if="icon" :class="cn(icon, ICON_GLYPH_SIZE_CLASS[size])" />
    <slot />
  </Primitive>
</template>
