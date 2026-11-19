<script setup lang="ts">
import type { ControlSize, FieldVariant } from '../styles'

import { ref } from 'vue'

import { cn } from '@/lib/utils'

import { FIELD_BASE_CLASS, FIELD_SIZE_CLASS, FIELD_VARIANT_CLASS } from '../styles'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  size?: ControlSize
  variant?: FieldVariant
  /** Icon class shown before the text, e.g. `i-lucide-search`. */
  prefixIcon?: string
  /** Class for the field box. Other attributes go to the native input. */
  class?: string
}>(), {
  size: 'md',
  variant: 'outlined',
})

// `v-model.number` is handled here because the native modifier does not reach
// an input nested inside a component.
const [model, modifiers] = defineModel<string | number, 'number' | 'trim'>({
  set(value) {
    if (typeof value !== 'string')
      return value
    if (modifiers.trim)
      value = value.trim()
    if (modifiers.number) {
      const parsed = Number.parseFloat(value)
      return Number.isNaN(parsed) ? value : parsed
    }
    return value
  },
})

const inputRef = ref<HTMLInputElement | null>(null)

defineExpose({
  focus: (options?: FocusOptions) => inputRef.value?.focus(options),
  select: () => inputRef.value?.select(),
})
</script>

<template>
  <div :class="cn(FIELD_BASE_CLASS, FIELD_SIZE_CLASS[size], FIELD_VARIANT_CLASS[variant], props.class)">
    <slot name="prefix">
      <span v-if="prefixIcon" :class="cn(prefixIcon, 'h-4 w-4 shrink-0 text-fg-3')" />
    </slot>
    <input
      ref="inputRef"
      v-model="model"
      v-bind="$attrs"
      class="min-w-0 flex-1 self-stretch border-0 bg-transparent p-0 text-inherit outline-none disabled:cursor-not-allowed placeholder:text-fg-4"
    >
    <slot name="suffix" />
  </div>
</template>
