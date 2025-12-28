<script setup lang="ts">
import { computed, ref, watch } from 'vue'

interface Props {
  src?: string
  name?: string
  size?: 'sm' | 'md' | 'lg'
  isOnline?: boolean
  eager?: boolean
  animated?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  isOnline: false,
  eager: false,
  animated: false,
})

const sizeMap = {
  sm: 'h-6 w-6',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
}

const avatarSize = computed(() => sizeMap[props.size])

const segmenter = typeof Intl.Segmenter !== 'undefined'
  ? new Intl.Segmenter('zh-CN', { granularity: 'grapheme' })
  : null

const initials = computed(() => {
  if (!props.name)
    return ''

  if (segmenter) {
    const segment = segmenter.segment(props.name)[Symbol.iterator]().next().value
    if (segment) {
      return segment.segment.toUpperCase()
    }
  }

  // Fallback for browsers that don't support Intl.Segmenter
  return props.name.trim().charAt(0).toUpperCase()
})

const backgroundColor = computed(() => {
  if (!props.name)
    return 'bg-neutral-100 dark:bg-gray-700'
  // Generate a fixed background color based on the name
  const colors = [
    'bg-red-500',
    'bg-pink-500',
    'bg-purple-500',
    'bg-indigo-500',
    'bg-blue-500',
    'bg-cyan-500',
    'bg-teal-500',
    'bg-green-500',
    'bg-lime-500',
    'bg-yellow-500',
    'bg-orange-500',
  ]
  const index = props.name.trim().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colors[index % colors.length]
})

const loaded = ref(false)
watch(() => props.src, () => {
  loaded.value = false
})
function handleLoaded() {
  loaded.value = true
}
</script>

<template>
  <div class="relative inline-block">
    <div
      class="relative flex items-center justify-center overflow-hidden rounded-full text-white font-medium" :class="[
        avatarSize,
        backgroundColor,
      ]"
    >
      <img
        v-if="src"
        :src="src"
        :alt="name"
        :loading="eager ? 'eager' : 'lazy'"
        decoding="async"
        :class="[
          'h-full w-full object-cover transition-all duration-300',
          animated
            ? (loaded ? 'opacity-100 blur-0 scale-100' : 'opacity-70 blur-sm scale-105')
            : '',
        ]"
        @load="handleLoaded"
        @error="handleLoaded"
      >
      <span v-else class="text-sm">{{ initials }}</span>
    </div>
    <div v-if="animated && src && !loaded" class="absolute inset-0 overflow-hidden rounded-full">
      <div class="shimmer" />
    </div>
    <div
      v-if="isOnline"
      class="absolute bottom-0 right-0 h-3 w-3 border-2 border-background rounded-full bg-green-500"
    />
  </div>
</template>

<style scoped>
.shimmer {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.25) 50%, rgba(255,255,255,0) 100%);
  animation: shimmer 1.2s infinite;
  transform: translateX(-100%);
}
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
</style>
