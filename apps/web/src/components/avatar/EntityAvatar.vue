<script setup lang="ts">
import { ref, watch } from 'vue'

import Avatar from '../ui/Avatar.vue'

import { useEntityAvatar } from '../../composables/useEntityAvatar'

interface Props {
  entity: 'self' | 'other'
  id: string | number
  entityType?: 'chat' | 'user'
  fileId?: string | number
  name?: string
  size?: 'sm' | 'md' | 'lg'
  ensureOnMount?: boolean
  forceRefresh?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  ensureOnMount: true,
  forceRefresh: true,
})

const { src } = useEntityAvatar(props)

const animated = ref(false)
watch(src, (newVal, oldVal) => {
  const hadBefore = Boolean(oldVal)
  const hasNow = Boolean(newVal)
  animated.value = !hadBefore && hasNow
})
</script>

<template>
  <Avatar :src="src" :name="props.name" :size="props.size" :animated="animated" />
</template>
