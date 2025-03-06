<!-- Theme toggle button with smooth animation -->
<script setup lang="ts">
import { useDarkStore } from '../composables/dark'

const { toggleDark } = useDarkStore()
</script>

<template>
  <button
    class="theme-toggle relative rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
    aria-label="Toggle theme"
    @click="toggleDark"
  >
    <div class="relative h-5 w-5">
      <!-- Sun icon -->
      <div
        class="absolute inset-0 transform-gpu text-gray-800 transition-all duration-500 dark:scale-0 dark:text-white dark:opacity-0 dark:-rotate-90"
      >
        <div class="i-lucide-sun h-5 w-5" />
      </div>
      <!-- Moon icon -->
      <div
        class="absolute inset-0 rotate-90 scale-0 transform-gpu text-gray-800 opacity-0 transition-all duration-500 dark:rotate-0 dark:scale-100 dark:text-white dark:opacity-100"
      >
        <div class="i-lucide-moon h-5 w-5" />
      </div>
    </div>
  </button>
</template>

<style scoped>
.theme-toggle {
  transition: all 0.3s ease;
  transform-origin: center;
}

/* Add a subtle hover effect */
.theme-toggle:hover {
  transform: scale(1.05);
}

/* Add active press effect */
.theme-toggle:active {
  transform: scale(0.95);
}
</style>
