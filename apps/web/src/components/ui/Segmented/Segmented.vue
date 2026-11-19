<script setup lang="ts" generic="T extends string | number">
import type { ControlSize } from '../styles'

import { cn } from '@/lib/utils'

export interface SegmentedOption<V> {
  value: V
  label: string
  icon?: string
}

const props = withDefaults(defineProps<{
  options: SegmentedOption<T>[]
  size?: ControlSize
  /** Stretch to the container and give every option equal width. */
  block?: boolean
  disabled?: boolean
  ariaLabel?: string
  class?: string
}>(), {
  size: 'md',
})

const emit = defineEmits<{
  /** Fired with the click event before the model changes (e.g. for view transitions). */
  select: [value: T, event: MouseEvent]
}>()

const model = defineModel<T>({ required: true })

const ITEM_SIZE_CLASS: Record<ControlSize, string> = {
  sm: 'h-6.5 px-2.5 text-xs',
  md: 'h-8 px-3 text-[13px]',
  lg: 'h-9 px-4 text-sm',
}

function select(value: T, event: MouseEvent) {
  emit('select', value, event)
  model.value = value
}
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="ariaLabel"
    :class="cn(
      'items-center gap-1 rounded-lg bg-fill-3 p-[3px]',
      block ? 'flex w-full' : 'inline-flex',
      props.class,
    )"
  >
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="model === option.value"
      :disabled="disabled"
      :class="cn(
        'inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium leading-none transition-[color,background-color,box-shadow,transform] duration-200 ease-out active:scale-98 disabled:cursor-not-allowed disabled:opacity-50',
        ITEM_SIZE_CLASS[size],
        block ? 'min-w-0 flex-1' : '',
        model === option.value
          ? 'bg-elevated text-fg shadow-sm dark:bg-fill'
          : 'text-fg-2 hover:text-fg',
      )"
      @click="select(option.value, $event)"
    >
      <span v-if="option.icon" :class="cn(option.icon, 'h-3.5 w-3.5 shrink-0')" />
      <span class="truncate">{{ option.label }}</span>
    </button>
  </div>
</template>
