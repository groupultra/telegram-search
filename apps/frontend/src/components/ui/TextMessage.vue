<script setup lang="ts">
defineProps<{
  text: string
}>()
</script>

<template>
  <p class="text-sm">
    {{ text }}
  </p>
</template>
