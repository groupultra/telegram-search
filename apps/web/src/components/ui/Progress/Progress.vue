<script setup lang="ts">
import type { ProgressRootProps } from 'reka-ui'

import { ProgressIndicator, ProgressRoot } from 'reka-ui'
import { computed } from 'vue'

import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<ProgressRootProps & { class?: string }>(),
  {
    modelValue: 0,
  },
)

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})
</script>

<template>
  <ProgressRoot
    v-bind="delegatedProps"
    :class="cn(
      'relative h-1.5 w-full overflow-hidden rounded-full bg-fill-2',
      props.class,
    )"
  >
    <ProgressIndicator
      class="h-full w-full flex-1 rounded-full bg-primary transition-transform duration-500 ease-out"
      :style="`transform: translateX(-${100 - (props.modelValue ?? 0)}%);`"
    />
  </ProgressRoot>
</template>
