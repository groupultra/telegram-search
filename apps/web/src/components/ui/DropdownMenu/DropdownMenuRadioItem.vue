<script setup lang="ts">
import type { DropdownMenuRadioItemEmits, DropdownMenuRadioItemProps } from 'reka-ui'

import {
  DropdownMenuItemIndicator,

  DropdownMenuRadioItem,
  useForwardPropsEmits,
} from 'reka-ui'
import { computed } from 'vue'

import { cn } from '@/lib/utils'

import { MENU_ITEM_CLASS } from '../styles'

const props = defineProps<DropdownMenuRadioItemProps & { class?: string }>()
const emits = defineEmits<DropdownMenuRadioItemEmits>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <DropdownMenuRadioItem
    v-bind="forwarded"
    :class="cn(
      `${MENU_ITEM_CLASS} pl-8`,
      props.class,
    )"
  >
    <span class="absolute left-2 h-3.5 w-3.5 flex items-center justify-center">
      <DropdownMenuItemIndicator>
        <span class="i-lucide-circle h-2 w-2 fill-current" />
      </DropdownMenuItemIndicator>
    </span>
    <slot />
  </DropdownMenuRadioItem>
</template>
