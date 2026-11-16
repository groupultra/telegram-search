<script setup lang="ts">
import type { ContextMenuSubTriggerProps } from 'reka-ui'

import { ContextMenuSubTrigger, useForwardProps } from 'reka-ui'
import { computed } from 'vue'

import { cn } from '@/lib/utils'

import { MENU_ITEM_CLASS } from '../styles'

const props = defineProps<ContextMenuSubTriggerProps & { class?: string, inset?: boolean }>()

const delegatedProps = computed(() => {
  const { class: _, inset, ...delegated } = props
  return delegated
})

const forwarded = useForwardProps(delegatedProps)
</script>

<template>
  <ContextMenuSubTrigger
    v-bind="forwarded"
    :class="cn(
      MENU_ITEM_CLASS,
      inset && 'pl-8',
      props.class,
    )"
  >
    <slot />
    <span class="i-lucide-chevron-right ml-auto h-4 w-4" />
  </ContextMenuSubTrigger>
</template>
