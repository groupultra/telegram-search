<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  modelValue: boolean
  maxWidth?: string
  persistent?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const dialogRef = ref<HTMLDialogElement | null>(null)
const isOpen = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// Handle outside clicks for non-persistent dialogs
function handleOutsideClick(event: MouseEvent) {
  if (!props.persistent && event.target === dialogRef.value) {
    isOpen.value = false
  }
}

// Handle escape key
function handleKeydown(event: KeyboardEvent) {
  if (!props.persistent && event.key === 'Escape' && isOpen.value) {
    isOpen.value = false
  }
}

// Manage body scroll
function disableScroll() {
  document.body.style.overflow = 'hidden'
}

function enableScroll() {
  document.body.style.overflow = ''
}

watch(isOpen, (value) => {
  if (value) {
    disableScroll()
  } else {
    enableScroll()
  }
})

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  enableScroll()
})
</script>

<template>
  <Transition name="dialog">
    <dialog
      v-if="isOpen"
      ref="dialogRef"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      :class="{ 'cursor-pointer': !persistent }"
      @click="handleOutsideClick"
    >
      <div
        class="relative w-full cursor-default rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
        :style="{ maxWidth: maxWidth || '32rem' }"
        @click.stop
      >
        <slot />
      </div>
    </dialog>
  </Transition>
</template>

<style scoped>
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.3s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

dialog {
  background: transparent;
  border: none;
}

dialog::backdrop {
  display: none;
}
</style> 
