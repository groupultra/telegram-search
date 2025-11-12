<script setup lang="ts">
interface ProgressProps {
  progress?: number
  label?: string
  message?: string
}

withDefaults(defineProps<ProgressProps>(), {
  progress: 0,
  label: '',
  message: '',
})
</script>

<template>
  <div class="w-full space-y-2">
    <div v-if="label || message" class="flex items-center justify-between text-sm">
      <span class="text-gray-700 font-medium dark:text-gray-300">{{ label }}</span>
      <span class="text-gray-600 dark:text-gray-400">{{ message }}</span>
    </div>
    <div class="flex items-center gap-3">
      <div class="h-2 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          class="h-full rounded-full bg-sky-500 transition-all duration-300 ease-out dark:bg-sky-400"
          :style="{ width: `${Math.min(100, Math.max(0, progress))}%` }"
        />
      </div>
      <span class="min-w-12 text-right text-sm text-gray-600 font-medium tabular-nums dark:text-gray-400">
        {{ Math.round(progress) }}%
      </span>
    </div>
  </div>
</template>
