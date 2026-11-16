<script setup lang="ts">
import type { DropdownMenuSubContentEmits, DropdownMenuSubContentProps } from 'reka-ui'

import {
  DropdownMenuSubContent,

  useForwardPropsEmits,
} from 'reka-ui'
import { computed } from 'vue'

import { cn } from '@/lib/utils'

import { MENU_POPUP_CLASS } from '../styles'

const props = defineProps<DropdownMenuSubContentProps & { class?: string }>()
const emits = defineEmits<DropdownMenuSubContentEmits>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <DropdownMenuSubContent
    v-bind="forwarded"
    :class="cn(
      MENU_POPUP_CLASS,
      props.class,
    )"
  >
    <slot />
  </DropdownMenuSubContent>
</template>
