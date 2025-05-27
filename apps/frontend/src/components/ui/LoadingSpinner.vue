<script setup lang="ts">
defineProps<{
  text?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  inline?: boolean
}>()
</script>

<template>
  <div 
    class="flex items-center gap-2" 
    :class="{ 
      'justify-center': !inline,
      'w-full': !inline,
    }"
  >
    <span 
      class="i-lucide-loader-circle animate-spin" 
      :class="{
        'text-xs': size === 'xs',
        'text-sm': size === 'sm',
        'text-base': size === 'md' || !size,
        'text-lg': size === 'lg',
      }"
    />
    <span 
      class="text-muted-foreground"
      :class="{
        'text-xs': size === 'xs',
        'text-sm': size === 'sm',
        'text-base': size === 'md' || !size,
        'text-lg': size === 'lg',
      }"
    >
      {{ text || '加载中...' }}
    </span>
  </div>
</template> 