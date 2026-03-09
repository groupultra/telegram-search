<script setup lang="ts">
import type { PaginationEllipsisProps } from 'reka-ui'

import { PaginationEllipsis } from 'reka-ui'
import { computed } from 'vue'

import { cn } from '@/lib/utils'

const props = defineProps<PaginationEllipsisProps & { class?: string }>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})
</script>

<template>
  <PaginationEllipsis
    v-bind="delegatedProps"
    :class="cn('flex h-9 w-9 items-center justify-center', props.class)"
  >
    <slot>
      <span class="i-lucide-more-horizontal h-4 w-4" />
      <span class="sr-only">More pages</span>
    </slot>
  </PaginationEllipsis>
</template>
