<script setup lang="ts">
import type { PaginationPrevProps } from 'reka-ui'

import { PaginationPrev } from 'reka-ui'
import { computed } from 'vue'

import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const props = defineProps<PaginationPrevProps & { class?: string }>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})
</script>

<template>
  <PaginationPrev v-bind="delegatedProps">
    <Button :class="cn('w-9 h-9 p-0', props.class)" variant="ghost" size="default">
      <slot>
        <span class="i-lucide-chevron-left h-4 w-4" />
        <span class="sr-only">Previous</span>
      </slot>
    </Button>
  </PaginationPrev>
</template>
