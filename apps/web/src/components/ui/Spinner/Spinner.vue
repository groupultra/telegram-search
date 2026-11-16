<script setup lang="ts">
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: string
}>()
</script>

<template>
  <span role="status" :class="cn('i-lucide-loader-circle inline-block h-4 w-4 animate-spin text-fg-3', props.class)" />
</template>
