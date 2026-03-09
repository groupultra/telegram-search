<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { cn } from '@/lib/utils'

import { useEntityAvatar } from '../../composables/useEntityAvatar'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '../ui/Avatar'

interface Props {
  entity: 'self' | 'other'
  id: string | number
  entityType?: 'chat' | 'user'
  fileId?: string | number
  name?: string
  size?: 'sm' | 'md' | 'lg'
  ensureOnMount?: boolean
  forceRefresh?: boolean
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  ensureOnMount: true,
  forceRefresh: true,
  size: 'md',
})

const { src } = useEntityAvatar(props)

const animated = ref(false)
watch(src, (newVal, oldVal) => {
  const hadBefore = Boolean(oldVal)
  const hasNow = Boolean(newVal)
  animated.value = !hadBefore && hasNow
})

const segmenter = typeof Intl.Segmenter !== 'undefined'
  ? new Intl.Segmenter('zh-CN', { granularity: 'grapheme' })
  : null

const initials = computed(() => {
  if (!props.name)
    return ''

  if (segmenter) {
    const iterator = segmenter.segment(props.name)[Symbol.iterator]()
    const segment = iterator.next().value
    if (segment) {
      return segment.segment.toUpperCase()
    }
  }

  return props.name.trim().charAt(0).toUpperCase()
})

const backgroundColor = computed(() => {
  if (!props.name)
    return 'bg-muted'

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

const sizeClass = computed(() => {
  switch (props.size) {
    case 'sm': return 'h-8 w-8 text-xs'
    case 'lg': return 'h-12 w-12 text-lg'
    default: return 'h-10 w-10 text-sm'
  }
})
</script>

<template>
  <Avatar :class="cn(sizeClass, props.class)">
    <AvatarImage
      v-if="src"
      :src="src"
      :alt="name"
      :class="cn(
        'object-cover transition-all duration-300',
        animated ? 'animate-in fade-in zoom-in-95 duration-300' : '',
      )"
    />
    <AvatarFallback :class="cn('text-white font-medium', backgroundColor)">
      {{ initials }}
    </AvatarFallback>
  </Avatar>
</template>
