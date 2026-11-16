<script setup lang="ts">
import type { ContextMenuSubContentEmits, ContextMenuSubContentProps } from 'reka-ui'

import {
  ContextMenuSubContent,

  useForwardPropsEmits,
} from 'reka-ui'
import { computed } from 'vue'

import { cn } from '@/lib/utils'

import { MENU_POPUP_CLASS } from '../styles'

const props = defineProps<ContextMenuSubContentProps & { class?: string }>()
const emits = defineEmits<ContextMenuSubContentEmits>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <ContextMenuSubContent
    v-bind="forwarded"
    :class="cn(
      MENU_POPUP_CLASS,
      props.class,
    )"
  >
    <slot />
  </ContextMenuSubContent>
</template>
