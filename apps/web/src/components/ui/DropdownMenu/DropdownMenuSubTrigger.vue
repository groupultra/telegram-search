<script setup lang="ts">
import type { DropdownMenuSubTriggerProps } from 'reka-ui'

import { DropdownMenuSubTrigger, useForwardProps } from 'reka-ui'
import { computed } from 'vue'

import { cn } from '@/lib/utils'

import { MENU_ITEM_CLASS } from '../styles'

const props = defineProps<DropdownMenuSubTriggerProps & { class?: string, inset?: boolean }>()

const delegatedProps = computed(() => {
  const { class: _, inset, ...delegated } = props
  return delegated
})

const forwarded = useForwardProps(delegatedProps)
</script>

<template>
  <DropdownMenuSubTrigger
    v-bind="forwarded"
    :class="cn(
      MENU_ITEM_CLASS,
      inset && 'pl-8',
      props.class,
    )"
  >
    <slot />
    <span class="i-lucide-chevron-right ml-auto h-4 w-4" />
  </DropdownMenuSubTrigger>
</template>
