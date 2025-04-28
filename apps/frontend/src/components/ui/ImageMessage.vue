<script setup lang="ts">
defineProps<{
  image: string
}>()
</script>

<template>
  <div class="max-w-[240px]">
    <img
      :src="image"
      alt="Image"
      class="h-auto w-full rounded-lg object-cover transition-all duration-200 hover:opacity-90"
    >
  </div>
</template>
