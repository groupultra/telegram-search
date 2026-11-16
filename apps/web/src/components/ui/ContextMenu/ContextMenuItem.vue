<script setup lang="ts">
import type { ContextMenuItemEmits, ContextMenuItemProps } from 'reka-ui'

import {
  ContextMenuItem,

  useForwardPropsEmits,
} from 'reka-ui'
import { computed } from 'vue'

import { cn } from '@/lib/utils'

import { MENU_ITEM_CLASS } from '../styles'

const props = defineProps<ContextMenuItemProps & { class?: string, inset?: boolean }>()
const emits = defineEmits<ContextMenuItemEmits>()

const delegatedProps = computed(() => {
  const { class: _, inset, ...delegated } = props
  return delegated
})

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <ContextMenuItem
    v-bind="forwarded"
    :class="cn(
      MENU_ITEM_CLASS,
      inset && 'pl-8',
      props.class,
    )"
  >
    <slot />
  </ContextMenuItem>
</template>
