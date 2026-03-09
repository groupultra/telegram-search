<script setup lang="ts">
import type { DropdownMenuLabelProps } from 'reka-ui'

import { DropdownMenuLabel } from 'reka-ui'
import { computed } from 'vue'

import { cn } from '@/lib/utils'

const props = defineProps<DropdownMenuLabelProps & { class?: string, inset?: boolean }>()

const delegatedProps = computed(() => {
  const { class: _, inset, ...delegated } = props
  return delegated
})
</script>

<template>
  <DropdownMenuLabel
    v-bind="delegatedProps"
    :class="cn(
      'px-2 py-1.5 text-sm font-semibold',
      inset && 'pl-8',
      props.class,
    )"
  >
    <slot />
  </DropdownMenuLabel>
</template>
