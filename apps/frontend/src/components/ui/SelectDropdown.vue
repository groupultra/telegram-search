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
    <label v-if="label" class="text-secondary-foreground mb-2 block text-sm font-medium">
      {{ label }}
    </label>
    <div class="relative">
      <select
        :value="modelValue"
        class="border-secondary bg-muted text-foreground focus:border-primary focus:ring-primary w-full appearance-none border rounded-md px-4 py-2.5 pr-10 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
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
      <div class="text-secondary-foreground pointer-events-none absolute inset-y-0 right-0 flex items-center px-3">
        <span>▼</span>
      </div>
    </div>
  </div>
</template>
