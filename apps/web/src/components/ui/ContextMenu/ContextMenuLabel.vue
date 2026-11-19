<script setup lang="ts">
import type { ContextMenuLabelProps } from 'reka-ui'

import { ContextMenuLabel } from 'reka-ui'
import { computed } from 'vue'

import { cn } from '@/lib/utils'

import { MENU_LABEL_CLASS } from '../styles'

const props = defineProps<ContextMenuLabelProps & { class?: string, inset?: boolean }>()

const delegatedProps = computed(() => {
  const { class: _, inset, ...delegated } = props
  return delegated
})
</script>

<template>
  <ContextMenuLabel
    v-bind="delegatedProps"
    :class="cn(
      MENU_LABEL_CLASS,
      inset && 'pl-8',
      props.class,
    )"
  >
    <slot />
  </ContextMenuLabel>
</template>
