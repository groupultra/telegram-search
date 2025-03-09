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
    <div class="relative">
      <select
        :value="modelValue"
        class="w-full appearance-none border border-gray-300 rounded-md bg-white px-4 py-2.5 pr-10 transition-colors dark:border-gray-600 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:border-blue-500 dark:focus:ring-blue-700/30"
        :disabled="disabled"
        @change="($event: Event) => {
          const target = $event.target as HTMLSelectElement
          emit('update:modelValue', target.value)
        }"
      >
        <option
          v-for="option in options"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
      <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 dark:text-gray-400">
        <span>▼</span>
      </div>
    </div>
  </div>
</template>
