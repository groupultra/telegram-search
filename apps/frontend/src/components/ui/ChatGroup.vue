<script setup lang="ts">
import type { CoreDialog } from '@tg-search/core'
import { ref } from 'vue'
import { Chat } from '../../types/chat';

const props = defineProps<{
  title: string
  avatar: string
  icon: string
  type: 'user' | 'group' | 'channel'
  chats: Chat[]
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
  <div class="flex items-center justify-between px-4 py-1 transition-all duration-300 hover:bg-gray-50 dark:hover:bg-gray-900 rounded-md cursor-pointer" @click="toggleActive">
    <div class="flex cursor-pointer items-center gap-1 text-sm font-medium">
      <div class="flex items-center gap-1">
        <div :class="props.icon" class="h-4 w-4" />
        <span class="select-none">{{ props.title }}</span>
      </div>
    </div>
    <div :class="active ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="h-4 w-4 cursor-pointer"/>
  </div>
  <ul v-show="active" class="px-2 space-y-1">
    <li v-for="chat in chats" :key="chat.id" :class="{ 'bg-gray-50 dark:bg-gray-900': chat.isSelected }" class="transition-colors duration-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md">
      <SlotButton :text="chat.name" @click="emit('click', chat)">
        <img :alt="`User ${chat.id}`" :src="`https://api.dicebear.com/6.x/bottts/svg?seed=${chat.name}`" class="h-full w-full object-cover select-none">
      </SlotButton>
    </li>
  </ul>
</template>
