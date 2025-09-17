<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const props = defineProps<{
  path: string
  icon: string
  name: string
}>()

const router = useRouter()
const route = useRoute()

const isCurrentPage = computed(() => route.path === props.path)
</script>

<template>
  <button
    type="button"
    :aria-current="isCurrentPage ? 'page' : undefined"
    class="w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition focus:outline-none"
    :class="isCurrentPage
      ? 'bg-[var(--gs-color-accent)] text-[var(--gs-color-text-inverse)] shadow-sm'
      : 'bg-transparent text-[var(--gs-color-text-secondary)] hover:bg-[var(--gs-color-surface-muted)]'
    "
    role="link"
    @click="router.push(props.path)"
  >
    <span :class="icon" class="h-5 w-5 flex-shrink-0" />
    <span class="flex-1 truncate text-left">{{ name }}</span>
    <span
      v-if="isCurrentPage"
      class="i-lucide-chevron-right h-4 w-4 opacity-80"
    />
  </button>
</template>
