<script setup lang="ts">
defineProps<{
  message?: string
  fullScreen?: boolean
  size?: 'sm' | 'md' | 'lg'
}>()
</script>

<template>
  <div
    class="flex flex-col items-center justify-center text-muted-foreground"
    :class="{ 
      'h-full w-full fixed inset-0 bg-background/80 backdrop-blur-sm z-50': fullScreen,
      'py-6': !fullScreen,
      'opacity-70': !fullScreen
    }"
  >
    <span 
      class="i-lucide-loader-circle animate-spin mb-2"
      :class="{
        'text-xl': size === 'sm',
        'text-3xl': size === 'md' || !size,
        'text-5xl': size === 'lg'
      }"
    />
    <span class="text-center">{{ message || '加载中...' }}</span>
  </div>
</template> 