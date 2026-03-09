<script setup lang="ts">
import type { AvatarRootProps } from 'reka-ui'

import { AvatarRoot } from 'reka-ui'

import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<AvatarRootProps & { class?: string, shape?: 'circle' | 'square' }>(), {
  shape: 'circle',
})
</script>

<template>
  <AvatarRoot
    v-bind="props"
    :class="cn(
      'relative flex h-10 w-10 shrink-0 overflow-hidden',
      shape === 'circle' ? 'rounded-full' : 'rounded-md',
      props.class,
    )"
  >
    <slot />
  </AvatarRoot>
</template>
