<script setup lang="ts">
import type { ContextMenuRadioItemEmits, ContextMenuRadioItemProps } from 'reka-ui'

import {
  ContextMenuItemIndicator,

  ContextMenuRadioItem,
  useForwardPropsEmits,
} from 'reka-ui'
import { computed } from 'vue'

import { cn } from '@/lib/utils'

import { MENU_ITEM_CLASS } from '../styles'

const props = defineProps<ContextMenuRadioItemProps & { class?: string }>()
const emits = defineEmits<ContextMenuRadioItemEmits>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <ContextMenuRadioItem
    v-bind="forwarded"
    :class="cn(
      `${MENU_ITEM_CLASS} pl-8`,
      props.class,
    )"
  >
    <span class="absolute left-2 h-3.5 w-3.5 flex items-center justify-center">
      <ContextMenuItemIndicator>
        <span class="i-lucide-circle h-2 w-2 fill-current" />
      </ContextMenuItemIndicator>
    </span>
    <slot />
  </ContextMenuRadioItem>
</template>
