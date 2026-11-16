<script setup lang="ts">
import type { FieldVariant } from '../styles'

import { cn } from '@/lib/utils'

import { CONTROL_TRANSITION, FIELD_VARIANT_CLASS } from '../styles'

const props = withDefaults(defineProps<{
  variant?: FieldVariant
  class?: string
}>(), {
  variant: 'outlined',
})

const model = defineModel<string | number>()
</script>

<template>
  <textarea
    v-model="model"
    :class="cn(
      'min-h-20 w-full flex rounded-md px-3 py-1.5 text-sm text-fg outline-none disabled:cursor-not-allowed placeholder:text-fg-4 disabled:opacity-60',
      CONTROL_TRANSITION,
      // The textarea is the focus target itself, so mirror the field's focus-within look.
      FIELD_VARIANT_CLASS[variant].replaceAll('focus-within:', 'focus:'),
      props.class,
    )"
  />
</template>
