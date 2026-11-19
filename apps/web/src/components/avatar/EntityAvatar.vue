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

// Fallback tint: a stable hue per name, drawn as a soft fill with same-hue
// text so letter avatars are distinguishable without shouting.
const fallbackHue = computed(() => {
  const name = props.name?.trim()
  if (!name)
    return undefined

  const seed = Array.from(name).reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return (seed * 47) % 360
})

const sizeClass = computed(() => {
  switch (props.size) {
    case 'sm': return 'h-8 w-8 text-[13px]'
    case 'lg': return 'h-12 w-12 text-base'
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
    <AvatarFallback
      :style="fallbackHue === undefined ? undefined : { '--avatar-hue': fallbackHue }"
      :class="fallbackHue === undefined
        ? 'bg-fill-2 text-fg-3 font-medium'
        : 'bg-[hsl(var(--avatar-hue)_70%_50%/0.16)] text-[hsl(var(--avatar-hue)_65%_36%)] font-medium dark:text-[hsl(var(--avatar-hue)_75%_74%)]'"
    >
      {{ initials }}
    </AvatarFallback>
  </Avatar>
</template>
