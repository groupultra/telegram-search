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
  <div
    :class="{ 'bg-accent text-accent-foreground': isCurrentPage }"
    class="relative mx-2 my-0.5 select-none rounded-md transition-colors hover:bg-accent hover:text-accent-foreground"
    :aria-current="isCurrentPage ? 'page' : undefined"
    role="link"
    @click="router.push(props.path)"
  >
    <div
      class="flex cursor-pointer items-center gap-3 px-3 py-2"
    >
      <span :class="icon" class="h-4 w-4 shrink-0" />
      <span class="truncate text-sm font-medium">{{ name }}</span>
    </div>
  </div>
</template>
