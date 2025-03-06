<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  icon: string
  label: string
}

defineProps<Props>()

const isOpen = ref(false)
</script>

<template>
  <div 
    class="relative"
    @mouseenter="isOpen = true"
    @mouseleave="isOpen = false"
  >
    <!-- Trigger button -->
    <IconButton
      :icon="icon"
      :aria-label="label"
      :class="{ 'text-blue-500': isOpen }"
      class="transition-colors duration-200"
    />

    <!-- Dropdown content -->
    <div
      v-show="isOpen"
      class="absolute right-0 z-50 w-48 border border-gray-200 rounded-md bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800 transition-all duration-200 ease-out"
      :class="[
        isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
      ]"
    >
      <!-- 添加一个透明的连接区域 -->
      <div class="absolute -top-2 left-0 w-full h-2" />
      <slot />
    </div>
  </div>
</template>

<style scoped>
/* 确保下拉菜单紧贴按钮 */
.relative {
  isolation: isolate;
}

/* 下拉菜单定位调整 */
.absolute {
  margin-top: 0.25rem;
}
</style> 
