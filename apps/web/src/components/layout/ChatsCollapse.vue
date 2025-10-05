<script setup lang="ts">
import type { CoreDialog, DialogType } from '@tg-search/core/types'

import { useRoute, useRouter } from 'vue-router'

import Avatar from '../ui/Avatar.vue'

defineProps<{
  type: DialogType
  icon: string
  name: string

  chats: CoreDialog[]
  active: boolean
}>()

const emit = defineEmits<{
  (e: 'update:toggle-active'): void
}>()

const router = useRouter()
const route = useRoute()

function isActiveChat(chatId: string) {
  return route.params.chatId === chatId
}

function toggleActive() {
  emit('update:toggle-active')
}
</script>

<template>
  <div>
    <div
      class="flex cursor-pointer items-center justify-between gap-4 px-4 py-2 hover:bg-neutral-100/70 dark:hover:bg-gray-700/60"
      @click="toggleActive"
    >
      <div
        class="flex items-center gap-4 rounded-md px-2 text-gray-900 dark:text-gray-100"
      >
        <span :class="icon" class="h-5 w-5" />
        <span class="whitespace-nowrap">{{ name }}</span>
      </div>

      <div
        :class="active ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
        class="h-4 w-4 cursor-pointer px-4 text-gray-900 transition-transform duration-200 dark:text-gray-100"
      />
    </div>

    <div
      v-show="active"
      v-auto-animate
      class="overflow-x-hidden overflow-y-auto transition-all duration-300"
    >
      <div
        v-for="chat in chats.filter(chat => chat.type === type)"
        :key="chat.id"
        :class="{ 'bg-neutral-100/90 dark:bg-gray-700/80': isActiveChat(chat.id.toString()) }"
        class="group relative flex flex-row cursor-pointer items-center justify-start gap-2 px-6 py-2 transition-all duration-200 hover:bg-neutral-100/70 dark:hover:bg-gray-700/60"
        @click="router.push(`/chat/${chat.id}`)"
      >
        <!-- Active left accent bar for chat item -->
        <span
          v-if="isActiveChat(chat.id.toString())"
          class="absolute left-0 top-0 h-full w-[2px] rounded-r bg-primary"
        />
        <Avatar
          :name="chat.name"
          size="sm"
        />
        <div class="flex flex-col overflow-hidden">
          <span class="truncate text-gray-900 dark:text-gray-100">
            {{ chat.name }}
          </span>

          <span class="whitespace-nowrap text-xs text-gray-600 dark:text-gray-400">
            {{ chat.id }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
