<script setup lang="ts">
import type { MessageProps } from '../../types/message-props'

defineProps<{
  text: string
}>()
</script>

<template>
  <p class="text-sm">{{ text }}</p>
</template>
