<script setup lang="ts">
import type { SelectTriggerProps } from 'reka-ui'

import { SelectTrigger, useForwardProps } from 'reka-ui'
import { computed } from 'vue'

import { cn } from '@/lib/utils'

import { FIELD_BASE_CLASS, FIELD_SIZE_CLASS, FIELD_VARIANT_CLASS } from '../styles'

const props = defineProps<SelectTriggerProps & { class?: string }>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})

const forwarded = useForwardProps(delegatedProps)
</script>

<template>
  <SelectTrigger
    v-bind="forwarded"
    :class="cn(
      FIELD_BASE_CLASS,
      FIELD_SIZE_CLASS.md,
      FIELD_VARIANT_CLASS.outlined,
      'justify-between outline-none data-[state=open]:bg-fill-3 data-[placeholder]:text-fg-4 [&>span]:line-clamp-1',
      props.class,
    )"
  >
    <slot />
    <span class="i-lucide-chevron-down h-4 w-4 shrink-0 text-fg-3" />
  </SelectTrigger>
</template>
