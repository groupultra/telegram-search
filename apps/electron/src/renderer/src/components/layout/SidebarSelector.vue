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
    :class="{ 'bg-muted dark:bg-muted': isCurrentPage }"
    class="px-4 transition-colors hover:bg-muted dark:hover:bg-muted"
    @click="router.push(props.path)"
  >
    <div
      class="w-full flex cursor-pointer items-center gap-4 p-2"
    >
      <span :class="icon" class="h-5 w-5" />
      <span>{{ name }}</span>
    </div>
  </div>
</template>
