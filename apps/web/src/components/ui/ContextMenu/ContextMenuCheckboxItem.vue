<script setup lang="ts">
import type { ContextMenuCheckboxItemEmits, ContextMenuCheckboxItemProps } from 'reka-ui'

import {
  ContextMenuCheckboxItem,

  ContextMenuItemIndicator,
  useForwardPropsEmits,
} from 'reka-ui'
import { computed } from 'vue'

import { cn } from '@/lib/utils'

import { MENU_ITEM_CLASS } from '../styles'

const props = defineProps<ContextMenuCheckboxItemProps & { class?: string }>()
const emits = defineEmits<ContextMenuCheckboxItemEmits>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <ContextMenuCheckboxItem
    v-bind="forwarded"
    :class="cn(
      `${MENU_ITEM_CLASS} pl-8`,
      props.class,
    )"
  >
    <span class="absolute left-2 h-3.5 w-3.5 flex items-center justify-center">
      <ContextMenuItemIndicator>
        <span class="i-lucide-check h-4 w-4" />
      </ContextMenuItemIndicator>
    </span>
    <slot />
  </ContextMenuCheckboxItem>
</template>
