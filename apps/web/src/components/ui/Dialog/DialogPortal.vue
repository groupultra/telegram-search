<script setup lang="ts">
import type { DialogPortalProps } from 'reka-ui'

import { DialogPortal } from 'reka-ui'

import DialogOverlay from './DialogOverlay.vue'

const props = defineProps<DialogPortalProps>()
</script>

<template>
  <DialogPortal v-bind="props">
    <DialogOverlay />
    <slot />
  </DialogPortal>
</template>
