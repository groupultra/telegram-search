<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const props = defineProps<{
  path: string
  icon: string
  name: string
  tooltip?: string
}>()

const router = useRouter()
const route = useRoute()

const isCurrentPage = computed(() => route.path === props.path)

// Show tooltip when name is empty (collapsed state) and tooltip is provided
const shouldShowTooltip = computed(() => !props.name && props.tooltip)
</script>

<template>
  <div
    :class="{ 'bg-neutral-100 dark:bg-neutral-100': isCurrentPage }"
    class="px-4 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-100"
    :title="shouldShowTooltip ? tooltip : undefined"
    @click="router.push(props.path)"
  >
    <div
      class="w-full flex cursor-pointer items-center gap-4 p-2"
      :class="{ 'justify-center': !name }"
    >
      <span :class="icon" class="h-5 w-5 flex-shrink-0" />
      <span v-if="name">{{ name }}</span>
    </div>
  </div>
</template>
