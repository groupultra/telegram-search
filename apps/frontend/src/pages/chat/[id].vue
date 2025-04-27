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
</script>

<template>
  <div>
    <h1>Chat {{ id }}</h1>
    <button class="rounded-md bg-blue-500 px-4 py-2 text-white" @click="props.changeTitle?.('New Title')">
      Change Title
    </button>
  </div>
</template>
