<!-- Loading Button component -->
<script setup lang="ts">
/**
 * Button with loading state support
 */
const props = defineProps<{
  /**
   * Button loading state
   */
  loading?: boolean
  /**
   * Button disabled state
   */
  disabled?: boolean
  /**
   * Button type
   */
  type?: 'button' | 'submit' | 'reset'
  /**
   * Button variant
   */
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'info'
  /**
   * Button size
   */
  size?: 'sm' | 'md' | 'lg'
  /**
   * Button full width
   */
  fullWidth?: boolean
  /**
   * Loading indicator position
   */
  loadingPosition?: 'start' | 'end'
  /**
   * Loading icon only
   */
  loadingIconOnly?: boolean
  /**
   * Custom loading icon
   */
  loadingIcon?: string
  /**
   * Start icon
   */
  startIcon?: string
  /**
   * End icon
   */
  endIcon?: string
}>()

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

const {
  loading = false,
  disabled = false,
  type = 'button',
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loadingPosition = 'start',
  loadingIconOnly = false,
  loadingIcon = 'i-lucide-circle-dash',
  startIcon,
  endIcon,
} = props

/**
 * Button variant classes
 */
const variantClasses = {
  primary: 'bg-blue-600 text-white dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 focus:ring-blue-500',
  secondary: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 focus:ring-gray-500',
  danger: 'bg-red-600 text-white dark:bg-red-700 hover:bg-red-700 dark:hover:bg-red-600 focus:ring-red-500',
  success: 'bg-green-600 text-white dark:bg-green-700 hover:bg-green-700 dark:hover:bg-green-600 focus:ring-green-500',
  warning: 'bg-yellow-500 text-white dark:bg-yellow-600 hover:bg-yellow-600 dark:hover:bg-yellow-500 focus:ring-yellow-500',
  info: 'bg-blue-500 text-white dark:bg-blue-600 hover:bg-blue-600 dark:hover:bg-blue-500 focus:ring-blue-500',
}

/**
 * Button size classes
 */
const sizeClasses = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-3 text-base',
}

/**
 * Handle button click event
 */
function handleClick(event: MouseEvent) {
  if (!loading && !disabled) {
    emit('click', event)
  }
}
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    class="relative inline-flex items-center justify-center border border-transparent rounded-md font-medium shadow-sm transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-offset-2"
    :class="[
      sizeClasses[size],
      variantClasses[variant],
      fullWidth ? 'w-full' : '',
    ]"
    @click="handleClick"
  >
    <!-- Loading spinner at start position -->
    <span
      v-if="loading && loadingPosition === 'start'"
      class="mr-2 inline-block animate-spin"
      :class="[loadingIcon]"
    />

    <!-- Start icon when not loading or when loadingPosition is end -->
    <span
      v-if="startIcon && (!loading || loadingPosition === 'end')"
      class="mr-2"
      :class="[startIcon]"
    />

    <!-- Button text content -->
    <span v-if="!loading || !loadingIconOnly">
      <slot />
    </span>

    <!-- Loading spinner at end position -->
    <span
      v-if="loading && loadingPosition === 'end'"
      class="ml-2 inline-block animate-spin"
      :class="[loadingIcon]"
    />

    <!-- End icon when not loading or when loadingPosition is start -->
    <span
      v-if="endIcon && (!loading || loadingPosition === 'start')"
      class="ml-2"
      :class="[endIcon]"
    />
  </button>
</template>

<style scoped>
.animate-spin {
  animation: spin 1.5s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
