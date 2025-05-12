<script setup lang="ts">
const props = defineProps<{
  icon: string
  size?: 'sm' | 'md' | 'lg'
  hasTooltip?: boolean
  darkModeText?: boolean
  withTransition?: boolean
  ariaLabel?: string
  disabled?: boolean
}>()

const sizeClasses = {
  sm: 'p-1',
  md: 'p-2',
  lg: 'p-3',
}

const iconSizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
}
</script>

<template>
  <button
    class="rounded-lg hover:bg-muted flex flex-row items-center justify-center gap-2 p-2"
    :class="[
      sizeClasses[size ?? 'md'],
      disabled ? 'cursor-not-allowed opacity-50' : '',
      hasTooltip ? 'group relative' : '',
      withTransition ? 'transition-colors duration-300' : '',
    ]"
    :aria-label="ariaLabel"
  >
    <div
      :class="[
        iconSizeClasses[size ?? 'md'],
        props.icon,
        darkModeText ? 'text-foreground' : '',
        withTransition ? 'transition-colors duration-300' : '',
      ]"
    />
    <slot />
  </button>
</template>
