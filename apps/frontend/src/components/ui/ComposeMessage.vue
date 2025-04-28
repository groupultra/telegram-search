<script setup lang="ts">
defineProps<{
  direction: 'row' | 'column'
}>()
</script>

<template>
  <div class="flex gap-2" :class="{ 'flex-row items-stretch': direction === 'row', 'flex-col items-start': direction === 'column' }">
    <div class="flex-1">
      <slot name="first" />
    </div>
    <!-- 分割线 -->
    <div
      class="transition-all duration-300 ease-in-out"
      :class="{
        'h-[2px] w-full bg-gray-100 dark:bg-gray-800 rounded-full my-2': direction === 'column',
        'min-h-full w-[2px] bg-gray-100 dark:bg-gray-800 rounded-full mx-2': direction === 'row',
      }"
    />
    <div class="flex-1">
      <slot name="second" />
    </div>
  </div>
</template>
