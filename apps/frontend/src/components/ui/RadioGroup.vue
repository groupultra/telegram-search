<script setup lang="ts">
interface Option<T> {
  label: string
  value: T
}

interface Props<T> {
  modelValue: T
  options: Option<T>[]
  disabled?: boolean
  label?: string
}

withDefaults(defineProps<Props<any>>(), {
  disabled: false,
  label: '',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: any): void
}>()
</script>

<template>
  <div>
    <label v-if="label" class="mb-2 block text-sm text-gray-700 font-medium dark:text-gray-300">
      {{ label }}
    </label>
    <div class="space-y-2.5">
      <label
        v-for="option in options"
        :key="option.value"
        class="flex cursor-pointer items-center border border-gray-200 rounded-md p-3 transition-colors dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/70"
        :class="{ 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20': modelValue === option.value }"
      >
        <input
          type="radio"
          :value="option.value"
          :checked="modelValue === option.value"
          class="h-4 w-4 border-gray-300 text-blue-600 dark:border-gray-600 dark:bg-gray-700 focus:ring-blue-500"
          :disabled="disabled"
          @change="$event => emit('update:modelValue', option.value)"
        >
        <span class="ml-2.5 text-sm">{{ option.label }}</span>
      </label>
    </div>
  </div>
</template>
