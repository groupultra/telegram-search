<script setup lang="ts">
import type { DropdownMenuContentEmits, DropdownMenuContentProps } from 'reka-ui'

import {
  DropdownMenuContent,

  DropdownMenuPortal,
  useForwardPropsEmits,
} from 'reka-ui'
import { computed } from 'vue'

import { cn } from '@/lib/utils'

import { MENU_POPUP_CLASS } from '../styles'

const props = withDefaults(
  defineProps<DropdownMenuContentProps & { class?: string }>(),
  {
    sideOffset: 4,
  },
)
const emits = defineEmits<DropdownMenuContentEmits>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <DropdownMenuPortal>
    <DropdownMenuContent
      v-bind="forwarded"
      :class="cn(
        MENU_POPUP_CLASS,
        props.class,
      )"
    >
      <slot />
    </DropdownMenuContent>
  </DropdownMenuPortal>
</template>
