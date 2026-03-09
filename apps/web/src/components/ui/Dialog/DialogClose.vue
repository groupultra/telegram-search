<script setup lang="ts">
import type { DialogCloseProps } from 'reka-ui'

import { DialogClose } from 'reka-ui'

import { cn } from '@/lib/utils'

const props = defineProps<DialogCloseProps & { class?: string }>()
</script>

<template>
  <DialogClose
    v-bind="props"
    :class="cn('absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground', props.class)"
  >
    <span class="i-lucide-x h-4 w-4" />
    <span class="sr-only">Close</span>
  </DialogClose>
</template>
