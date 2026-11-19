<script setup lang="ts">
import type { DropdownMenuItemProps } from 'reka-ui'

import { DropdownMenuItem, useForwardProps } from 'reka-ui'
import { computed } from 'vue'

import { cn } from '@/lib/utils'

import { MENU_ITEM_CLASS } from '../styles'

const props = defineProps<DropdownMenuItemProps & { class?: string, inset?: boolean }>()

const delegatedProps = computed(() => {
  const { class: _, inset, ...delegated } = props
  return delegated
})

const forwarded = useForwardProps(delegatedProps)
</script>

<template>
  <DropdownMenuItem
    v-bind="forwarded"
    :class="cn(
      MENU_ITEM_CLASS,
      inset && 'pl-8',
      props.class,
    )"
  >
    <slot />
  </DropdownMenuItem>
</template>
