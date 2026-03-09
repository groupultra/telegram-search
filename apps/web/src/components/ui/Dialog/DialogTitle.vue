<script setup lang="ts">
import type { DialogTitleProps } from 'reka-ui'

import { DialogTitle, useForwardProps } from 'reka-ui'
import { computed } from 'vue'

import { cn } from '@/lib/utils'

const props = defineProps<DialogTitleProps & { class?: string }>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})

const forwarded = useForwardProps(delegatedProps)
</script>

<template>
  <DialogTitle
    v-bind="forwarded"
    :class="cn(
      'text-lg font-semibold leading-none tracking-tight',
      props.class,
    )"
  >
    <slot />
  </DialogTitle>
</template>
