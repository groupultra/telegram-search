<script setup lang="ts">
import type { ContextMenuContentEmits, ContextMenuContentProps } from 'reka-ui'

import {
  ContextMenuContent,

  ContextMenuPortal,
  useForwardPropsEmits,
} from 'reka-ui'
import { computed } from 'vue'

import { cn } from '@/lib/utils'

import { MENU_POPUP_CLASS } from '../styles'

const props = defineProps<ContextMenuContentProps & { class?: string }>()
const emits = defineEmits<ContextMenuContentEmits>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <ContextMenuPortal>
    <ContextMenuContent
      v-bind="forwarded"
      :class="cn(
        MENU_POPUP_CLASS,
        props.class,
      )"
    >
      <slot />
    </ContextMenuContent>
  </ContextMenuPortal>
</template>
