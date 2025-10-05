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
    :class="{ 'bg-neutral-100/90 dark:bg-gray-700/80': isCurrentPage }"
    class="relative select-none px-4 text-gray-900 transition-all hover:bg-neutral-100/70 dark:text-gray-100 dark:hover:bg-gray-700/60"
    :aria-current="isCurrentPage ? 'page' : undefined"
    role="link"
    @click="router.push(props.path)"
  >
    <!-- Active left accent bar -->
    <span
      v-if="isCurrentPage"
      class="absolute left-0 top-0 h-full w-[2px] rounded-r bg-primary"
    />

    <div
      class="w-full flex cursor-pointer items-center gap-4 p-2"
    >
      <span :class="icon" class="h-5 w-5 flex-shrink-0 opacity-90" />
      <span class="truncate">{{ name }}</span>
    </div>
  </div>
</template>
