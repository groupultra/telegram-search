<script setup lang="ts">
interface Option<T> {
  label: string
  value: T
}

interface Props<T> {
  modelValue: T[]
  options: Option<T>[]
  disabled?: boolean
  label?: string
  columns?: number
  class?: string
  labelClass?: string
  optionClass?: string
  checkboxClass?: string
}

const props = withDefaults(defineProps<Props<any>>(), {
  disabled: false,
  label: '',
  columns: 2,
  class: '',
  labelClass: 'mb-2 block text-sm text-gray-700 font-medium dark:text-gray-300',
  optionClass: 'hover:bg-gray-50 dark:hover:bg-gray-700/70',
  checkboxClass: 'dark:border-gray-600 dark:bg-gray-700 focus:ring-blue-500',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: any[]): void
}>()

function handleChange(option: any, checked: boolean): void {
  const newValue = [...props.modelValue]

  if (checked) {
    if (!newValue.includes(option)) {
      newValue.push(option)
    }
  }
  else {
    const index = newValue.indexOf(option)
    if (index !== -1) {
      newValue.splice(index, 1)
    }
  }

  emit('update:modelValue', newValue)
}

function isChecked(value: any): boolean {
  return props.modelValue.includes(value)
}
</script>

<template>
  <div :class="props.class">
    <label v-if="label" :class="props.labelClass">
      {{ label }}
    </label>
    <div :style="`display: grid; grid-template-columns: repeat(${columns}, minmax(0, 1fr)); gap: 0.75rem;`">
      <label
        v-for="option in options"
        :key="option.value"
        :style="{
          display: 'flex',
          cursor: 'pointer',
          alignItems: 'center',
          border: isChecked(option.value) ? '1px solid rgb(147, 197, 253)' : '1px solid rgb(229, 231, 235)',
          borderRadius: '0.375rem',
          padding: '0.75rem',
          transition: 'all 0.2s',
          backgroundColor: isChecked(option.value) ? 'rgb(239, 246, 255)' : 'transparent',
        }"
        :class="[
          props.optionClass,
          {
            'dark:border-blue-700 dark:bg-blue-900/20': isChecked(option.value),
            'dark:border-gray-700': !isChecked(option.value),
          },
        ]"
      >
        <input
          type="checkbox"
          :checked="isChecked(option.value)"
          :style="{
            height: '1rem',
            width: '1rem',
            borderRadius: '0.25rem',
            borderColor: 'rgb(209, 213, 219)',
            color: 'rgb(37, 99, 235)',
            transition: 'all 0.2s',
          }"
          :class="props.checkboxClass"
          :disabled="disabled"
          @change="(e: Event) => handleChange(option.value, (e.target as HTMLInputElement).checked)"
        >
        <span style="margin-left: 0.625rem; font-size: 0.875rem;">{{ option.label }}</span>
      </label>
    </div>
  </div>
</template>
