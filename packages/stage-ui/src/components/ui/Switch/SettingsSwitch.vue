<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'radix-vue'
import { computed } from 'vue'
import { cn } from '../../../lib/utils'

type SwitchSize = 'sm' | 'md'

interface Props {
  modelValue: boolean
  label?: string
  disabled?: boolean
  size?: SwitchSize
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  size: 'sm',
  loading: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'change', value: boolean): void
}>()

// 尺寸样式映射
const sizeClasses = {
  sm: {
    switch: 'h-4 w-7',
    thumb: 'h-[0.85rem] w-3',
    label: 'text-xs',
    translate: 'data-[state=checked]:translate-x-[14px]',
  },
  md: {
    switch: 'h-6 w-11',
    thumb: 'h-5 w-5',
    label: 'text-sm',
    translate: 'data-[state=checked]:translate-x-[22px]',
  },
}

// 计算开关容器类名
const switchClasses = computed(() => cn(
  'flex-shrink-0 rounded-full',
  'bg-[var(--gs-color-surface-muted)]',
  'transition-colors duration-200 ease-in-out',
  'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
  'focus:outline-none focus:ring-2 focus:ring-[var(--gs-color-accent)]/25',
  'data-[state=checked]:bg-[var(--gs-color-accent)]',
  sizeClasses[props.size].switch,
))

// 计算开关滑块类名
const thumbClasses = computed(() => cn(
  'block translate-x-[2px] rounded-full',
  'bg-white',
  'transition-transform duration-200 ease-in-out',
  props.loading && 'animate-pulse',
  sizeClasses[props.size].thumb,
  sizeClasses[props.size].translate,
))

// 计算标签类名
const labelClasses = computed(() => cn(
  'ml-3',
  'text-[var(--gs-color-text-primary)]',
  sizeClasses[props.size].label,
))
</script>

<template>
  <div class="inline-flex items-center gap-2" :class="{ 'cursor-wait': loading }">
      <SwitchRoot
        :checked="modelValue"
        :disabled="disabled || loading"
        :class="switchClasses"
        @update:checked="(val) => {
          emit('update:modelValue', val)
          emit('change', val)
        }"
      >
      <SwitchThumb :class="thumbClasses" />
    </SwitchRoot>
    <span v-if="label" :class="labelClasses">{{ label }}</span>
  </div>
</template>
