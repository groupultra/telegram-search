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
const contentRef = ref<HTMLDivElement | null>(null)

const isOpen = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

// Handle outside clicks for non-persistent dialogs
function handleOutsideClick(event: MouseEvent) {
  if (!props.persistent && event.target === dialogRef.value) {
    closeWithAnimation()
  }
}

// Handle escape key
function handleKeydown(event: KeyboardEvent) {
  if (!props.persistent && event.key === 'Escape' && isOpen.value) {
    closeWithAnimation()
  }
}

// 关闭时添加动画
function closeWithAnimation() {
  if (contentRef.value) {
    contentRef.value.classList.add('dialog-content-leave')
    setTimeout(() => {
      isOpen.value = false
    }, 200)
  }
  else {
    isOpen.value = false
  }
}

// Manage body scroll
function disableScroll() {
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
  document.body.style.overflow = 'hidden'
  document.body.style.paddingRight = `${scrollbarWidth}px`
}

function enableScroll() {
  document.body.style.overflow = ''
  document.body.style.paddingRight = ''
}

watch(isOpen, (value) => {
  if (value) {
    disableScroll()
    // 打开时重置动画类
    if (contentRef.value) {
      contentRef.value.classList.remove('dialog-content-leave')
    }
  }
  else {
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
      class="fixed inset-0 z-50 flex items-center justify-center overflow-hidden p-4 backdrop-blur-sm"
      :class="{ 'cursor-pointer': !persistent }"
      @click="handleOutsideClick"
    >
      <!-- 背景遮罩 -->
      <div class="absolute inset-0 bg-black/60 transition-opacity duration-300" />

      <!-- 对话框内容 -->
      <div
        ref="contentRef"
        class="dialog-content relative w-full cursor-default rounded-lg bg-white p-6 shadow-2xl ring-1 ring-gray-950/5 dark:bg-gray-800 dark:ring-white/10"
        :style="{ maxWidth: maxWidth || '32rem' }"
        @click.stop
      >
        <slot />
      </div>
    </dialog>
  </Transition>
</template>

<style scoped>
/* 背景动画 */
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.3s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

/* 内容动画 */
.dialog-content {
  animation: dialog-content-enter 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.dialog-content-leave {
  animation: dialog-content-leave 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes dialog-content-enter {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes dialog-content-leave {
  from {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
  to {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
}

dialog {
  background: transparent;
  border: none;
}

dialog::backdrop {
  display: none;
}
</style>
