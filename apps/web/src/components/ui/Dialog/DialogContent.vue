<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from 'reka-ui'

import { DialogContent, useForwardPropsEmits } from 'reka-ui'
import { computed } from 'vue'

import { cn } from '@/lib/utils'

import DialogClose from './DialogClose.vue'
import DialogOverlay from './DialogOverlay.vue'
import DialogPortal from './DialogPortal.vue'

const props = withDefaults(defineProps<DialogContentProps & { class?: string, showCloseButton?: boolean }>(), {
  showCloseButton: true,
})
const emits = defineEmits<DialogContentEmits>()

const delegatedProps = computed(() => {
  const { class: _, showCloseButton: __, ...delegated } = props
  void _
  void __
  return delegated
})

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <DialogPortal>
    <DialogOverlay />
    <DialogContent
      v-bind="forwarded"
      :class="cn(
        'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg',
        props.class,
      )"
    >
      <slot />
      <DialogClose v-if="props.showCloseButton" />
    </DialogContent>
  </DialogPortal>
</template>
