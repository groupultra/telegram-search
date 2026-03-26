<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const props = defineProps<{
  path: string
  icon: keyof typeof SIDEBAR_ICON_CLASS
  name: string
}>()

const SIDEBAR_ICON_CLASS = {
  'chats': 'i-lucide-message-circle',
  'ai-chat': 'i-lucide-message-square-text',
  'settings': 'i-lucide-settings',
  'sync': 'i-lucide-refresh-cw',
} as const

const router = useRouter()
const route = useRoute()

const isCurrentPage = computed(() => route.path === props.path)
const iconClass = computed(() => SIDEBAR_ICON_CLASS[props.icon])
</script>

<template>
  <div
    :class="[
      isCurrentPage ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
    ]"
    class="group relative mx-0 my-0.5 cursor-pointer select-none overflow-hidden rounded-lg transition-all duration-200"
    :aria-current="isCurrentPage ? 'page' : undefined"
    role="link"
    @click="router.push(props.path)"
  >
    <div
      class="flex cursor-pointer items-center gap-2.5 px-3 py-2"
    >
      <span :class="iconClass" class="h-4.5 w-4.5 shrink-0 transition-transform duration-200 group-hover:scale-110" />
      <span class="truncate text-sm">{{ name }}</span>
    </div>

    <!-- Active Indicator -->
    <div
      v-if="isCurrentPage"
      class="absolute left-0 top-1/2 h-5 w-0.5 rounded-r-full bg-primary -translate-y-1/2"
    />
  </div>
</template>
