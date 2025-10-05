<script setup lang="ts">
import { computed } from 'vue'

interface ColorHueRangeProps {
  disabled?: boolean
  class?: string
}

const props = defineProps<ColorHueRangeProps>()

const hueValue = defineModel<number>({
  default: 0,
})

const sliderClasses = computed(() => [
  'color-hue-range',
  props.disabled ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer',
  props.class ?? '',
])
</script>

<template>
  <input
    v-model.number="hueValue"
    type="range"
    min="0"
    max="360"
    step="0.01"
    :disabled="props.disabled"
    :class="sliderClasses"
  >
</template>

<style scoped>
.color-hue-range {
  --at-apply: appearance-none h-10 rounded-lg;
  background: linear-gradient(
    to right,
    oklch(85% 0.2 0),
    oklch(85% 0.2 60),
    oklch(85% 0.2 120),
    oklch(85% 0.2 180),
    oklch(85% 0.2 240),
    oklch(85% 0.2 300),
    oklch(85% 0.2 360)
  );
}

.color-hue-range::-webkit-slider-thumb {
  --at-apply: w-1 h-12 appearance-none rounded-md bg-neutral-600 cursor-pointer shadow-lg border-2 border-neutral-500
    hover:bg-neutral-800 transition-colors duration-200;
}

.dark .color-hue-range::-webkit-slider-thumb {
  --at-apply: w-1 h-12 appearance-none rounded-md bg-neutral-100 cursor-pointer shadow-md border-2 border-white
    hover:bg-neutral-300 transition-colors duration-200;
}

.color-hue-range::-moz-range-thumb {
  --at-apply: w-1 h-12 appearance-none rounded-md bg-neutral-600 cursor-pointer shadow-lg border-2 border-neutral-500
    hover:bg-neutral-800 transition-colors duration-200;
}

.dark .color-hue-range::-moz-range-thumb {
  --at-apply: w-1 h-12 appearance-none rounded-md bg-neutral-100 cursor-pointer shadow-md border-2 border-white
    hover:bg-neutral-300 transition-colors duration-200;
}
</style>
