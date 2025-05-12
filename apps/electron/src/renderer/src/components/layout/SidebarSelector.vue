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
    class="transition-colors hover:bg-muted dark:hover:bg-muted px-4"
    @click="router.push(props.path)"
  >
    <div
      class="w-full flex items-center gap-4 p-2 cursor-pointer"
    >
      <span :class="icon" class="h-5 w-5" />
      <span>{{ name }}</span>
    </div>
  </div>
</template>
