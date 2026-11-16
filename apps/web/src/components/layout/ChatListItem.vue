<script setup lang="ts">
import type { CoreDialog } from '@tg-search/core/types'

import EntityAvatar from '../avatar/EntityAvatar.vue'

import { formatChatTimestamp } from '../../utils/chat-list'
import { Badge } from '../ui/Badge'
import { Checkbox } from '../ui/Checkbox'
import { LIST_ITEM_ACTIVE_CLASS, LIST_ITEM_CLASS } from '../ui/styles'

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
    :class="[LIST_ITEM_CLASS, active || inAiContext ? LIST_ITEM_ACTIVE_CLASS : '']"
    class="chat-list-item mb-0.5 h-14 overflow-hidden px-2!"
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
    <div class="min-w-0 flex flex-1 flex-col gap-0.5 font-normal">
      <div class="flex items-center justify-between gap-2">
        <span class="truncate text-sm text-fg font-medium leading-5">
          {{ chat.name }}
        </span>
        <span
          v-if="chat.lastMessageDate"
          class="shrink-0 text-[11px] text-fg-3 leading-none"
        >
          {{ formatChatTimestamp(chat.lastMessageDate) }}
        </span>
      </div>

      <div class="h-4.5 flex items-center justify-between gap-2">
        <div class="min-w-0 truncate text-xs text-fg-3 leading-4.5">
          <template v-if="preview?.text">
            <span v-if="preview.sender" class="text-fg-2">{{ preview.sender }}: </span>
            <span>{{ preview.text }}</span>
          </template>
        </div>

        <!-- Display only: the whole row toggles the selection. -->
        <Checkbox
          v-if="selectionMode"
          :model-value="inAiContext"
          tabindex="-1"
          class="pointer-events-none"
        />
        <Badge v-else-if="(chat.unreadCount ?? 0) > 0" :count="chat.unreadCount ?? 0" />
        <span v-else-if="pinned" class="i-lucide-pin h-3.5 w-3.5 shrink-0 rotate-45 text-fg-4" />
        <span v-else-if="inAiContext" class="i-lucide-sparkles h-3.5 w-3.5 shrink-0 text-fg-2" />
      </div>
    </div>
  </div>
</template>
