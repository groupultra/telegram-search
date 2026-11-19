<script setup lang="ts">
import type { ContextMenuSeparatorProps } from 'reka-ui'

import { ContextMenuSeparator } from 'reka-ui'
import { computed } from 'vue'

import { cn } from '@/lib/utils'

import { MENU_SEPARATOR_CLASS } from '../styles'

const props = defineProps<ContextMenuSeparatorProps & { class?: string }>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})
</script>

<template>
  <ContextMenuSeparator
    v-bind="delegatedProps"
    :class="cn(MENU_SEPARATOR_CLASS, props.class)"
  />
</template>
