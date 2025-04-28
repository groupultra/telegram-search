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
  <div class="flex cursor-pointer items-center justify-between rounded-md px-4 py-1 text-foreground transition-all duration-300 hover:bg-muted" @click="toggleActive">
    <div class="flex cursor-pointer items-center gap-1 text-sm font-medium">
      <div class="flex items-center gap-1">
        <div :class="props.icon" class="h-4 w-4" />
        <span class="select-none">{{ props.title }}</span>
      </div>
    </div>
    <div :class="active ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="h-4 w-4 cursor-pointer" />
  </div>
  <ul v-show="active" class="scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent max-h-40 overflow-y-auto px-2 space-y-1">
    <li v-for="chat in chats" :key="chat.id" :class="{ 'bg-muted': chat.id === props.selectedChatId }" class="rounded-md transition-colors duration-100 hover:bg-muted">
      <SlotButton :text="chat.name.slice(0, 22) + (chat.name.length > 22 ? '...' : '')" @click="emit('click', chat)">
        <img :alt="`User ${chat.id}`" :src="`https://api.dicebear.com/6.x/bottts/svg?seed=${chat.name}`" class="h-full w-full select-none object-cover">
      </SlotButton>
    </li>
  </ul>
</template>

<style scoped>
/* 自定义滚动条样式 */
.scrollbar-thin::-webkit-scrollbar {
  width: 4px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: var(--un-color-muted);
  border-radius: 4px;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background-color: var(--un-color-muted-foreground);
}
</style>
