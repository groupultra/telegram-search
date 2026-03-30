<script setup lang="ts">
import type { PropType } from 'vue'

import { computed, ref } from 'vue'

import { cn } from '@/lib/utils'

const props = defineProps({
  defaultValue: Boolean,
  modelValue: {
    type: Boolean as PropType<boolean | null>,
    default: undefined,
  },
  disabled: Boolean,
  id: String,
  name: String,
  required: Boolean,
  value: String,
  class: String,
  checked: {
    type: Boolean as PropType<boolean | null>,
    default: undefined,
  },
})
const emits = defineEmits<{
  'update:modelValue': [payload: boolean]
  'update:checked': [payload: boolean]
}>()
const uncontrolledValue = ref(props.defaultValue ?? false)

const checkedValue = computed({
  get: () => props.modelValue ?? props.checked ?? uncontrolledValue.value,
  set: (value: boolean) => {
    handleUpdate(value)
  },
})

function handleUpdate(value: boolean) {
  if (props.modelValue == null && props.checked == null) {
    uncontrolledValue.value = value
  }

  emits('update:modelValue', value)
  emits('update:checked', value)
}
</script>

<template>
  <button
    :id="props.id"
    :name="props.name"
    :value="props.value"
    :disabled="props.disabled"
    :aria-checked="checkedValue"
    :aria-required="props.required"
    :data-state="checkedValue ? 'checked' : 'unchecked'"
    role="switch"
    type="button"
    :class="cn(
      'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-[background-color,box-shadow] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
      props.class,
    )"
    @click="handleUpdate(!checkedValue)"
  >
    <span
      aria-hidden="true"
      :data-state="checkedValue ? 'checked' : 'unchecked'"
      :class="cn('pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform duration-200 ease-out will-change-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0')"
    />
  </button>
</template>
