<script setup lang="ts">
import type { PaginationNextProps } from 'reka-ui'

import { PaginationNext } from 'reka-ui'
import { computed } from 'vue'

import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const props = defineProps<PaginationNextProps & { class?: string }>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})
</script>

<template>
  <PaginationNext v-bind="delegatedProps">
    <Button :class="cn('w-9 h-9 p-0', props.class)" variant="ghost" size="default">
      <slot>
        <span class="i-lucide-chevron-right h-4 w-4" />
        <span class="sr-only">Next</span>
      </slot>
    </Button>
  </PaginationNext>
</template>
