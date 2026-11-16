<script setup lang="ts">
import type { CoreDialog } from '@tg-search/core/types'

import EntityAvatar from '../avatar/EntityAvatar.vue'

import { formatChatTimestamp } from '../../utils/chat-list'

defineProps<{
  chat: CoreDialog
  preview?: { sender?: string, text?: string }
  active: boolean
  pinned: boolean
  inAiContext: boolean
  selectionMode: boolean
}>()
</script>

<template>
  <div
    :class="[
      active
        ? 'bg-foreground/8'
        : inAiContext ? 'bg-primary/6' : 'hover:bg-foreground/4',
    ]"
    class="chat-list-item group mx-2 mb-0.5 flex cursor-pointer items-center gap-3 overflow-hidden rounded-lg px-2.5 py-2 transition-colors duration-150"
  >
    <EntityAvatar
      :id="chat.id"
      entity="other"
      entity-type="chat"
      :file-id="chat.avatarFileId"
      :name="chat.name"
      size="md"
      class="shrink-0"
    />
    <div class="min-w-0 flex flex-1 flex-col gap-1">
      <div class="flex items-baseline justify-between gap-2">
        <span class="truncate text-sm text-foreground font-medium leading-tight">
          {{ chat.name }}
        </span>
        <span
          v-if="chat.lastMessageDate"
          class="shrink-0 text-[10px] text-muted-foreground leading-none font-mono tabular-nums"
        >
          {{ formatChatTimestamp(chat.lastMessageDate) }}
        </span>
      </div>

      <div class="h-4 flex items-center justify-between gap-2">
        <div class="min-w-0 truncate text-xs text-muted-foreground leading-tight">
          <template v-if="preview?.text">
            <span
              v-if="preview.sender"
              class="text-foreground/75 font-medium"
            >
              {{ preview.sender }}:
            </span>
            <span>{{ preview.text }}</span>
          </template>
        </div>

        <div
          v-if="selectionMode"
          class="h-4 w-4 flex shrink-0 items-center justify-center border rounded transition-colors"
          :class="inAiContext ? 'border-primary bg-primary text-primary-foreground' : 'border-input text-transparent'"
        >
          <span class="i-lucide-check h-3 w-3" />
        </div>

        <span
          v-else-if="(chat.unreadCount ?? 0) > 0"
          class="h-4 min-w-4 inline-flex shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground font-semibold leading-none tabular-nums"
        >
          {{ chat.unreadCount! > 99 ? '99+' : chat.unreadCount }}
        </span>

        <span
          v-else-if="pinned"
          class="i-lucide-pin h-3 w-3 shrink-0 rotate-45 text-muted-foreground/60"
        />

        <span
          v-else-if="inAiContext"
          class="i-lucide-sparkles h-3 w-3 shrink-0 text-primary"
        />
      </div>
    </div>
  </div>
</template>
