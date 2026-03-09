<script setup lang="ts">
import type { AvatarFallbackProps } from 'reka-ui'

import { AvatarFallback } from 'reka-ui'

import { cn } from '@/lib/utils'

const props = defineProps<AvatarFallbackProps & { class?: string }>()
</script>

<template>
  <AvatarFallback
    v-bind="props"
    :class="cn(
      'flex h-full w-full items-center justify-center rounded-full bg-muted',
      props.class,
    )"
  >
    <slot />
  </AvatarFallback>
</template>
