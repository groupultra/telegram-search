<!-- Icon Button component -->
<script setup lang="ts">
/**
 * Simple icon button component
 */
const props = defineProps<{
  /**
   * Icon class name (e.g. i-lucide-settings)
   */
  icon: string
  /**
   * Button size
   */
  size?: 'sm' | 'md' | 'lg'
  /**
   * Disabled state
   */
  disabled?: boolean
  /**
   * Custom classes to apply
   */
  customClass?: string
  /**
   * Whether the button has a tooltip
   */
  hasTooltip?: boolean
  /**
   * Whether to apply dark mode text colors
   */
  darkModeText?: boolean
  /**
   * Whether to apply transition effects
   */
  withTransition?: boolean
  /**
   * ARIA label for accessibility
   */
  ariaLabel?: string
}>()

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

/**
 * Default values for props
 */
const {
  size = 'md',
  disabled = false,
  customClass = '',
  hasTooltip = false,
  darkModeText = true,
  withTransition = false,
  ariaLabel,
} = props

/**
 * Size classes mapping
 */
const sizeClasses = {
  sm: 'p-1',
  md: 'p-2',
  lg: 'p-3',
}

/**
 * Icon size classes mapping
 */
const iconSizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
}

/**
 * Handle click event
 */
function handleClick(event: MouseEvent) {
  if (!disabled) {
    emit('click', event)
  }
}
</script>

<template>
  <button
    class="rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" :class="[
      sizeClasses[size],
      disabled ? 'cursor-not-allowed opacity-50' : '',
      hasTooltip ? 'group relative' : '',
      withTransition ? 'transition-colors duration-300' : '',
      customClass,
    ]"
    :disabled="disabled"
    :aria-label="ariaLabel"
    @click="handleClick"
  >
    <div
      :class="[
        iconSizeClasses[size],
        props.icon,
        darkModeText ? 'dark:text-white' : '',
        withTransition ? 'transition-colors duration-300' : '',
      ]"
    />
    <slot />
  </button>
</template>
