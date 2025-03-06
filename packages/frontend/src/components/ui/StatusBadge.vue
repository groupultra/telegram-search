<script setup lang="ts">
import type { CommandStatus } from '@tg-search/server'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'

interface Props {
  status: CommandStatus
  label: string
  icon?: string
}

const props = defineProps<Props>()

const statusClasses = computed(() => {
  const classes = {
    pending: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
    waiting: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
    running: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
  }

  return classes[props.status]
})
</script>

<template>
  <span
    class="flex items-center rounded-full px-3 py-1 text-sm font-medium transition-colors"
    :class="statusClasses"
  >
    <span v-if="icon" class="mr-1.5">
      <Icon :icon="icon" />
    </span>
    <span>{{ label }}</span>
  </span>
</template>
