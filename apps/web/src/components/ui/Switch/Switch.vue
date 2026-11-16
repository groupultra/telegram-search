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
      'peer inline-flex h-[22px] w-9 shrink-0 cursor-pointer items-center rounded-full p-0.5 shadow-[inset_0_1.5px_2px_rgb(0_0_0/8%)] transition-colors duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-45 data-[state=checked]:bg-primary data-[state=unchecked]:bg-fill-2 data-[state=checked]:hover:bg-primary-hover data-[state=unchecked]:hover:bg-fill',
      props.class,
    )"
    @click="handleUpdate(!checkedValue)"
  >
    <span
      aria-hidden="true"
      :data-state="checkedValue ? 'checked' : 'unchecked'"
      :class="cn('pointer-events-none block h-[18px] w-[18px] rounded-full bg-white shadow-[0_0_0_0.5px_rgb(0_0_0/4%),0_1px_1px_rgb(0_0_0/6%),0_3px_8px_rgb(0_30_80/16%)] transition-transform duration-200 ease-out will-change-transform data-[state=checked]:translate-x-3.5 data-[state=unchecked]:translate-x-0')"
    />
  </button>
</template>
