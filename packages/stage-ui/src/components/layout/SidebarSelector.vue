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
      ? 'bg-[#3A3A3C] text-white'
      : 'bg-transparent text-gray-300 hover:bg-[#353538]'
    "
    role="link"
    @click="router.push(props.path)"
  >
    <span :class="icon" class="h-5 w-5 flex-shrink-0" />
    <span class="flex-1 truncate text-left">{{ name }}</span>
    <span
      v-if="isCurrentPage"
      class="i-lucide-chevron-right h-4 w-4 text-gray-400"
    />
  </button>
</template>
