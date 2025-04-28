<script setup lang="ts">
import type { Action } from '../../types/action'
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps<{
  changeTitle?: (title: string) => void
  setActions?: (actions: Action[]) => void
}>()
const route = useRoute()
const id = route.params.id

onMounted(() => {
  props.changeTitle?.(`👀 ${id}`)
  props.setActions?.([{
    icon: 'i-lucide-search',
    onClick: () => {

    },
  }])
})
</script>

<template>
  <div class="h-full flex flex-col p-2">
    <div class="overflow-auto space-y-0" />
  </div>
</template>
