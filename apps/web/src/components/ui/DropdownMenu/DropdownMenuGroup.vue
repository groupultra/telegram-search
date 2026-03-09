<script setup lang="ts">
import type { DropdownMenuGroupProps } from 'reka-ui'

import { DropdownMenuGroup } from 'reka-ui'
import { computed } from 'vue'

import { cn } from '@/lib/utils'

const props = defineProps<DropdownMenuGroupProps & { class?: string }>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})
</script>

<template>
  <DropdownMenuGroup v-bind="delegatedProps" :class="cn(props.class)">
    <slot />
  </DropdownMenuGroup>
</template>
