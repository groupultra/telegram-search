<script setup lang="ts">
import { computed } from 'vue'

import { ActionIcon } from './ui/ActionIcon'
import { CONTROL_TRANSITION, FIELD_VARIANT_CLASS } from './ui/styles'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  placeholder?: string
  /** Grow with the text (textarea) instead of a single-line input. */
  multiline?: boolean
  sendDisabled?: boolean
  sendLabel?: string
}>()

const emit = defineEmits<{
  send: []
}>()

const model = defineModel<string>({ required: true })

const canSend = computed(() => !props.sendDisabled && model.value.trim().length > 0)
const FIELD_CLASS = 'min-w-0 flex-1 border-0 bg-transparent px-1.5 text-sm text-fg outline-none placeholder:text-fg-4'
</script>

<template>
  <!-- One composer for the chat page and AI chat. Key handlers and other
       attributes are forwarded to the text field. -->
  <div :class="[FIELD_VARIANT_CLASS.outlined, CONTROL_TRANSITION]" class="mx-auto max-w-3xl w-full flex items-end gap-1 rounded-lg p-1.5 shadow-sm">
    <slot name="prefix" />
    <textarea
      v-if="multiline"
      v-model="model"
      v-bind="$attrs"
      rows="1"
      :placeholder="placeholder"
      :class="FIELD_CLASS"
      class="[field-sizing:content] max-h-40 min-h-8 resize-none py-1.5 leading-5"
    />
    <input
      v-else
      v-model="model"
      v-bind="$attrs"
      type="text"
      :placeholder="placeholder"
      :class="FIELD_CLASS"
      class="h-8"
    >
    <slot name="actions" />
    <ActionIcon
      icon="i-lucide-arrow-up"
      :title="sendLabel"
      :disabled="!canSend"
      class="rounded-full"
      :class="canSend ? 'bg-primary text-primary-foreground! hover:bg-primary-hover' : 'bg-fill-2 text-fg-4!'"
      @click="emit('send')"
    />
  </div>
</template>
