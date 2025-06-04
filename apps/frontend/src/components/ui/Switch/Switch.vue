<script setup lang="ts">
interface Props {
  /**
   * The checked state of the switch
   */
  modelValue: boolean
  /**
   * The label text to display next to the switch
   */
  label?: string
  /**
   * Whether the switch is disabled
   */
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

function handleChange(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.checked)
}
</script>

<template>
  <div class="flex items-center">
    <label class="relative inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        :checked="modelValue"
        :disabled="disabled"
        class="peer sr-only"
        @change="handleChange"
      >
      <div
        class="h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/25 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 dark:bg-gray-600 dark:after:border-gray-600 dark:after:bg-gray-700 dark:peer-checked:bg-primary"
      />
      <span
        v-if="label"
        class="ml-3 text-sm text-gray-900 dark:text-gray-100"
      >
        {{ label }}
      </span>
    </label>
  </div>
</template>
