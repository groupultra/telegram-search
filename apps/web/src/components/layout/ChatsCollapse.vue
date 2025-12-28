<script setup lang="ts">
import type { CoreDialog, DialogType } from '@tg-search/core/types'

import { useRoute, useRouter } from 'vue-router'

import EntityAvatar from '../avatar/EntityAvatar.vue'

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
  return route.params.id === chatId
}

function toggleActive() {
  emit('update:toggle-active')
}
</script>

<template>
  <div>
    <div
      class="mx-2 my-0.5 flex cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 transition-colors hover:bg-accent hover:text-accent-foreground"
      @click="toggleActive"
    >
      <div
        class="flex items-center gap-3"
      >
        <span :class="icon" class="h-4 w-4" />
        <span class="whitespace-nowrap text-sm font-medium">{{ name }}</span>
      </div>

      <div
        :class="active ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
        class="h-4 w-4 transition-transform duration-200"
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
        :class="{ 'bg-accent text-accent-foreground': isActiveChat(chat.id.toString()) }"
        class="group mx-2 my-0.5 flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 transition-colors hover:bg-accent hover:text-accent-foreground"
        @click="router.push(`/chat/${chat.id}`)"
      >
        <EntityAvatar
          :id="chat.id"
          entity="other"
          entity-type="chat"
          :name="chat.name"
          size="sm"
        />
        <div class="min-w-0 flex flex-1 flex-col">
          <span class="truncate text-sm font-medium">
            {{ chat.name }}
          </span>

          <span class="truncate text-xs text-muted-foreground">
            {{ chat.id }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
