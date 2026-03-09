<script setup lang="ts">
import type { AvatarImageProps } from 'reka-ui'

import { AvatarImage } from 'reka-ui'

import { cn } from '@/lib/utils'

const props = defineProps<AvatarImageProps & { class?: string }>()
</script>

<template>
  <AvatarImage
    v-bind="props"
    :class="cn('aspect-square h-full w-full', props.class)"
  />
</template>
