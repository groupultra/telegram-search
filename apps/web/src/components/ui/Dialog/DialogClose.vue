<script setup lang="ts">
import type { DialogCloseProps } from 'reka-ui'

import { DialogClose } from 'reka-ui'

import { cn } from '@/lib/utils'

const props = defineProps<DialogCloseProps & { class?: string }>()
</script>

<template>
  <DialogClose
    v-bind="props"
    :class="cn('absolute right-3 top-3 h-8 w-8 inline-flex items-center justify-center rounded-sm text-fg-3 transition-colors hover:bg-fill-2 hover:text-fg-2 disabled:pointer-events-none', props.class)"
  >
    <span class="i-lucide-x h-4 w-4" />
    <span class="sr-only">Close</span>
  </DialogClose>
</template>
