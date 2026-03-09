<script setup lang="ts">
import type { PaginationListProps } from 'reka-ui'

import { PaginationList } from 'reka-ui'
import { computed } from 'vue'

import { cn } from '@/lib/utils'

const props = defineProps<PaginationListProps & { class?: string }>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})
</script>

<template>
  <PaginationList v-bind="delegatedProps" :class="cn('flex items-center gap-1', props.class)">
    <slot />
  </PaginationList>
</template>
