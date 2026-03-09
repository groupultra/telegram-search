<script setup lang="ts">
import type { DialogOverlayProps } from 'reka-ui'

import { DialogOverlay } from 'reka-ui'

import { cn } from '@/lib/utils'

const props = defineProps<DialogOverlayProps & { class?: string }>()
</script>

<template>
  <DialogOverlay
    v-bind="props"
    :class="cn(
      'fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      props.class,
    )"
  />
</template>
