<script setup lang="ts">
import type { DropdownMenuLabelProps } from 'reka-ui'

import { DropdownMenuLabel } from 'reka-ui'
import { computed } from 'vue'

import { cn } from '@/lib/utils'

import { MENU_LABEL_CLASS } from '../styles'

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
      MENU_LABEL_CLASS,
      inset && 'pl-8',
      props.class,
    )"
  >
    <slot />
  </DropdownMenuLabel>
</template>
