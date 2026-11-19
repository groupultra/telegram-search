<script setup lang="ts">
import type { CheckboxRootEmits, CheckboxRootProps } from 'reka-ui'

import { CheckboxIndicator, CheckboxRoot, useForwardPropsEmits } from 'reka-ui'
import { computed } from 'vue'

import { cn } from '@/lib/utils'

const props = defineProps<CheckboxRootProps & { class?: string }>()
const emits = defineEmits<CheckboxRootEmits>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <CheckboxRoot
    v-bind="forwarded"
    :class="
      cn(
        'peer h-4 w-4 shrink-0 rounded-xs border border-line bg-container transition-colors duration-150 hover:border-fg-4 disabled:cursor-not-allowed disabled:opacity-40 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:bg-fill-3',
        props.class,
      )
    "
  >
    <CheckboxIndicator class="h-full w-full flex items-center justify-center text-current">
      <slot>
        <span class="i-lucide-check h-3 w-3 [&>*]:stroke-3" />
      </slot>
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
