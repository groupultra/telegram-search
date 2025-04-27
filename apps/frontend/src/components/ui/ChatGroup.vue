<script setup lang="ts">
import type { CoreDialog } from '@tg-search/core'
import { ref } from 'vue'

const props = defineProps<{
  title: string
  avatar: string
  chats: CoreDialog[]
}>()

const emit = defineEmits<{
  (e: 'click', chat: CoreDialog): void
}>()
const active = ref(true)
function toggleActive() {
  active.value = !active.value
}
</script>

<template>
  <div class="flex items-center justify-between px-4 py-2 transition-all duration-300">
    <div class="flex cursor-pointer items-center gap-1 text-sm font-medium" @click="toggleActive">
      <div :class="active ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="h-4 w-4" />
      <span>{{ props.title }}</span>
    </div>
    <button class="hover:bg-muted h-5 w-5 flex items-center justify-center rounded-md p-1">
      <div class="i-lucide-plus-circle h-4 w-4" />
    </button>
  </div>
  <ul class="px-2 space-y-1" :class="{ hidden: !active }">
    <li v-for="chat in chats" :key="chat.id">
      <button class="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm" @click="emit('click', chat)">
        <div class="h-6 w-6 flex items-center justify-center overflow-hidden rounded-full">
          <img :alt="`User ${chat.id}`" class="h-full w-full object-cover">
        </div>
        <span>{{ chat.name }}</span>
      </button>
    </li>
  </ul>
</template>
