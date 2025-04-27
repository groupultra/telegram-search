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
})
</script>

<template>
  <div>
    <h1>Chat {{ id }}</h1>
  </div>
</template>
