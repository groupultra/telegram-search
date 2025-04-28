<script setup lang="ts">
import type { CoreDialog } from '@tg-search/core'
import type { Chat } from '../../types/chat'
import { ref } from 'vue'

const props = defineProps<{
  title: string
  avatar: string
  icon: string
  type: 'user' | 'group' | 'channel'
  chats: Chat[]
  selectedChatId?: number | null
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
  <div class="flex cursor-pointer items-center justify-between rounded-md px-4 py-1 transition-all duration-300 hover:bg-gray-50 dark:hover:bg-gray-900" @click="toggleActive">
    <div class="flex cursor-pointer items-center gap-1 text-sm font-medium">
      <div class="flex items-center gap-1">
        <div :class="props.icon" class="h-4 w-4" />
        <span class="select-none">{{ props.title }}</span>
      </div>
    </div>
    <div :class="active ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="h-4 w-4 cursor-pointer" />
  </div>
  <ul v-show="active" class="max-h-40 overflow-y-auto px-2 space-y-1">
    <li v-for="chat in chats" :key="chat.id" :class="{ 'bg-gray-50 dark:bg-gray-900': chat.id === props.selectedChatId }" class="rounded-md transition-colors duration-100 hover:bg-gray-100 dark:hover:bg-gray-800">
      <SlotButton :text="chat.name.slice(0, 22) + (chat.name.length > 22 ? '...' : '')" @click="emit('click', chat)">
        <img :alt="`User ${chat.id}`" :src="`https://api.dicebear.com/6.x/bottts/svg?seed=${chat.name}`" class="h-full w-full select-none object-cover">
      </SlotButton>
    </li>
  </ul>
</template>
