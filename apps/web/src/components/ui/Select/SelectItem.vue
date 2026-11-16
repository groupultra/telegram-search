<script setup lang="ts">
import type { SelectItemProps } from 'reka-ui'

import {
  SelectItem,
  SelectItemIndicator,

  SelectItemText,
  useForwardProps,
} from 'reka-ui'
import { computed } from 'vue'

import { cn } from '@/lib/utils'

import { MENU_ITEM_CLASS } from '../styles'

const props = defineProps<SelectItemProps & { class?: string }>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})

const forwarded = useForwardProps(delegatedProps)
</script>

<template>
  <SelectItem
    v-bind="forwarded"
    :class="cn(
      MENU_ITEM_CLASS,
      'w-full justify-between',
      props.class,
    )"
  >
    <SelectItemText>
      <slot />
    </SelectItemText>

    <SelectItemIndicator class="flex items-center">
      <span class="i-lucide-check h-4 w-4" />
    </SelectItemIndicator>
  </SelectItem>
</template>
