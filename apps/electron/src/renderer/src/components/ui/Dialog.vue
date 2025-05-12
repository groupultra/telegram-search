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
const isVisible = ref(false)

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
    }, 100)
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
    isVisible.value = true
    disableScroll()
    // 打开时重置动画类
    if (contentRef.value) {
      contentRef.value.classList.remove('dialog-content-leave')
    }
  }
  else {
    setTimeout(() => {
      isVisible.value = false
    }, 100)
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
  <Teleport to="body">
    <div
      v-show="isVisible"
      ref="dialogRef"
      class="fixed inset-0 z-50 h-[100dvh] w-[100dvw] overflow-hidden p-4"
      :class="{ 'cursor-pointer': !persistent }"
      @click="handleOutsideClick"
    >
      <!-- 背景遮罩 -->
      <Transition name="fade">
        <div v-show="isVisible" class="absolute inset-0 h-full w-full backdrop-blur-sm" />
      </Transition>

      <!-- 对话框内容 -->
      <div class="z-51 h-full w-full flex items-center justify-center">
        <Transition name="dialog">
          <div
            v-show="isVisible"
            ref="contentRef"
            class="dialog-content relative w-full cursor-default rounded-lg bg-popover p-6 shadow-2xl ring-1 ring-secondary/10"
            :style="{ maxWidth: maxWidth || '32rem' }"
            @click.stop
          >
            <slot />
          </div>
        </Transition>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* 背景遮罩动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease-in-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 对话框内容动画 */
.dialog-enter-active,
.dialog-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.dialog-enter-to,
.dialog-leave-from {
  opacity: 1;
  transform: scale(1);
}

dialog {
  background: transparent;
  border: none;
}

dialog::backdrop {
  display: none;
}
</style>
