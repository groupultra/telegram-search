<script setup lang="ts">
import type { PaginationListItemProps } from 'reka-ui'

import { PaginationListItem } from 'reka-ui'
import { computed } from 'vue'

import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

type Props = PaginationListItemProps & {
  class?: string
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

const props = defineProps<Props>()

const delegatedProps = computed(() => {
  const { class: _, size, ...delegated } = props
  return delegated
})
</script>

<template>
  <PaginationListItem v-bind="delegatedProps">
    <Button :class="cn('w-9 h-9 p-0', props.class)" :size="size" variant="ghost">
      <slot />
    </Button>
  </PaginationListItem>
</template>
