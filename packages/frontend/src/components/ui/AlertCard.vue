<!-- Alert Card component for showing various notifications -->
<script setup lang="ts">
import { computed } from 'vue'

/**
 * Alert component for displaying various types of notifications
 */
const props = defineProps<{
  /**
   * Type of alert to display
   */
  type: 'info' | 'success' | 'warning' | 'error'
  /**
   * Main title of the alert
   */
  title?: string
  /**
   * Whether to show an icon
   */
  showIcon?: boolean
  /**
   * Custom classes to apply to the component
   */
  customClass?: string
}>()

/**
 * Gets the icon class based on the alert type
 */
const iconClass = computed(() => {
  const iconMap: Record<string, string> = {
    info: 'i-lucide-info',
    success: 'i-lucide-circle-check',
    warning: 'i-lucide-circle-alert',
    error: 'i-lucide-circle-x',
  }
  return iconMap[props.type] || 'i-lucide-info'
})

/**
 * Gets the background color class based on the alert type
 */
const bgColorClass = computed(() => {
  const colorMap: Record<string, string> = {
    info: 'bg-blue-50 dark:bg-blue-900/30',
    success: 'bg-green-50 dark:bg-green-900/30',
    warning: 'bg-yellow-50 dark:bg-yellow-900/30',
    error: 'bg-red-50 dark:bg-red-900/30',
  }
  return colorMap[props.type] || 'bg-blue-50 dark:bg-blue-900/30'
})

/**
 * Gets the text color class based on the alert type
 */
const textColorClass = computed(() => {
  const colorMap: Record<string, string> = {
    info: 'text-blue-800 dark:text-blue-200',
    success: 'text-green-800 dark:text-green-200',
    warning: 'text-yellow-800 dark:text-yellow-200',
    error: 'text-red-800 dark:text-red-200',
  }
  return colorMap[props.type] || 'text-blue-800 dark:text-blue-200'
})

/**
 * Gets the description text color class based on the alert type
 */
const descriptionColorClass = computed(() => {
  const colorMap: Record<string, string> = {
    info: 'text-blue-700 dark:text-blue-300',
    success: 'text-green-700 dark:text-green-300',
    warning: 'text-yellow-700 dark:text-yellow-300',
    error: 'text-red-700 dark:text-red-300',
  }
  return colorMap[props.type] || 'text-blue-700 dark:text-blue-300'
})

/**
 * Gets the icon color class based on the alert type
 */
const iconColorClass = computed(() => {
  const colorMap: Record<string, string> = {
    info: 'text-blue-400',
    success: 'text-green-400',
    warning: 'text-yellow-400',
    error: 'text-red-400',
  }
  return colorMap[props.type] || 'text-blue-400'
})
</script>

<template>
  <div
    class="animate-fadeIn rounded-md p-4"
    :class="[bgColorClass, customClass]"
  >
    <div class="flex">
      <div v-if="showIcon" class="flex-shrink-0">
        <div
          class="h-5 w-5"
          :class="[iconClass, iconColorClass]"
          aria-hidden="true"
        />
      </div>
      <div :class="{ 'ml-3': showIcon }">
        <h3
          v-if="title"
          class="text-sm font-medium"
          :class="textColorClass"
        >
          {{ title }}
        </h3>
        <div
          class="text-sm" :class="[
            title ? 'mt-2' : '',
            descriptionColorClass,
          ]"
        >
          <slot />
        </div>
        <div v-if="$slots.actions" class="mt-4">
          <div class="flex -mx-2 -my-1.5">
            <slot name="actions" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-fadeIn {
  animation: fadeIn 0.5s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
