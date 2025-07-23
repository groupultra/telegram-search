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
    :class="{ 'bg-neutral-100 dark:bg-gray-700': isCurrentPage }"
    class="px-4 text-gray-900 transition-colors hover:bg-neutral-100 dark:text-gray-100 dark:hover:bg-gray-700"
    @click="router.push(props.path)"
  >
    <div
      class="w-full flex cursor-pointer items-center gap-4 p-2"
    >
      <span :class="icon" class="h-5 w-5 flex-shrink-0" />
      <span>{{ name }}</span>
    </div>
  </div>
</template>
