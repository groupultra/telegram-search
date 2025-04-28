<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: boolean
  label?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

function toggle() {
  if (!props.disabled) {
    emit('update:modelValue', !props.modelValue)
  }
}

const buttonClasses = computed(() => ({
  'bg-primary dark:bg-primary': props.modelValue,
  'bg-muted dark:bg-muted': !props.modelValue,
  'opacity-50 cursor-not-allowed': props.disabled,
  'cursor-pointer': !props.disabled,
}))

const toggleClasses = computed(() => ({
  'translate-x-5': props.modelValue,
  'translate-x-0': !props.modelValue,
}))
</script>

<template>
  <button
    type="button"
    :aria-checked="modelValue"
    :aria-label="label"
    :disabled="disabled"
    class="relative h-6 w-11 inline-flex flex-shrink-0 border-2 border-transparent rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
    :class="buttonClasses"
    @click="toggle"
  >
    <span
      class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
      :class="toggleClasses"
    />
  </button>
</template>
