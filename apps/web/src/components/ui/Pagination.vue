<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  /**
   * Current page number (starting from 1)
   */
  modelValue: number
  /**
   * Total number of pages
   */
  total: number
  /**
   * Number of visible page buttons (excluding ellipsis)
   * @default 7
   */
  visibleButtons?: number
  /**
   * Theme color
   * @default 'blue'
   */
  theme?: 'blue' | 'gray' | 'green' | 'red' | 'yellow' | 'purple'
}

const props = withDefaults(defineProps<Props>(), {
  visibleButtons: 7,
  theme: 'blue',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

const themeClasses = {
  blue: 'bg-blue-500 text-white hover:bg-blue-600',
  gray: 'bg-gray-500 text-white hover:bg-gray-600',
  green: 'bg-green-500 text-white hover:bg-green-600',
  red: 'bg-red-500 text-white hover:bg-red-600',
  yellow: 'bg-yellow-500 text-white hover:bg-yellow-600',
  purple: 'bg-purple-500 text-white hover:bg-purple-600',
}

// Calculate the page numbers to display
const visiblePages = computed(() => {
  const pages: (number | string)[] = []
  const halfVisible = Math.floor(props.visibleButtons / 2)

  // If total pages is less than or equal to visible buttons, display all page numbers
  if (props.total <= props.visibleButtons) {
    return Array.from({ length: props.total }, (_, i) => i + 1)
  }

  // Current page number is near the start
  if (props.modelValue <= halfVisible + 1) {
    for (let i = 1; i <= props.visibleButtons - 1; i++)
      pages.push(i)
    pages.push('...')
    pages.push(props.total)
    return pages
  }

  // Current page number is near the end
  if (props.modelValue >= props.total - halfVisible) {
    pages.push(1)
    pages.push('...')
    for (let i = props.total - props.visibleButtons + 2; i <= props.total; i++)
      pages.push(i)
    return pages
  }

  // Current page number is in the middle
  pages.push(1)
  pages.push('...')
  for (let i = props.modelValue - halfVisible + 2; i <= props.modelValue + halfVisible - 2; i++)
    pages.push(i)
  pages.push('...')
  pages.push(props.total)
  return pages
})

function changePage(page: number | string) {
  if (typeof page === 'string')
    return
  emit('update:modelValue', page)
}
</script>

<template>
  <div class="mx-auto max-w-2xl w-full flex items-center justify-center gap-3">
    <!-- Previous page -->
    <button
      class="h-8 w-8 flex items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      :class="[
        modelValue === 1
          ? 'text-gray-400 dark:text-gray-600'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
      ]"
      :disabled="modelValue === 1"
      @click="changePage(modelValue - 1)"
    >
      <div class="i-lucide-chevron-left h-4 w-4" />
    </button>

    <!-- Page number buttons -->
    <button
      v-for="page in visiblePages"
      :key="page"
      class="h-8 min-w-[2.5rem] flex items-center justify-center rounded-md px-3 text-sm transition-colors"
      :class="[
        typeof page === 'string'
          ? 'cursor-default text-gray-400 dark:text-gray-600'
          : page === modelValue
            ? themeClasses[theme]
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
      ]"
      @click="changePage(page)"
    >
      {{ page }}
    </button>

    <!-- Next page -->
    <button
      class="h-8 w-8 flex items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      :class="[
        modelValue === total
          ? 'text-gray-400 dark:text-gray-600'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
      ]"
      :disabled="modelValue === total"
      @click="changePage(modelValue + 1)"
    >
      <div class="i-lucide-chevron-right h-4 w-4" />
    </button>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
