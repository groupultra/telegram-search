<script setup lang="ts">
import type { MessageProps } from '../../types/message-props'

defineProps<{
  image: string
}>()
</script>

<template>
  <div class="max-w-[240px]">
    <img 
      :src="image" 
      alt="Image" 
      class="w-full h-auto rounded-lg object-cover transition-all duration-200 hover:opacity-90"
    />
  </div>
</template>
