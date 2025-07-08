<script setup lang="ts">
import type { CoreMessage } from '@tg-search/core/types'

import { useClipboard } from '@vueuse/core'
import { ref } from 'vue'

import Avatar from '../ui/Avatar.vue'

const props = defineProps<{
  messages: CoreMessage[]
  keyword: string
}>()

const hoveredMessage = ref<CoreMessage | null>(null)
const { copy, copied } = useClipboard()

function highlightKeyword(text: string, keyword: string) {
  if (!keyword)
    return text
  const regex = new RegExp(`(${keyword})`, 'gi')
  return text.replace(regex, '<span class="bg-yellow-200 dark:bg-yellow-800">$1</span>')
}

function copyMessageLink(message: CoreMessage) {
  copy(`https://t.me/c/${message.chatId}/${message.platformMessageId}`)
}
</script>

<template>
  <ul class="scrollbar-thin scrollbar-thumb-secondary scrollbar-track-transparent max-h-[540px] flex flex-col animate-fade-in overflow-y-auto">
    <li
      v-for="item in props.messages"
      :key="item.uuid"
      class="group animate-slide-in relative flex cursor-pointer items-center gap-2 border-b p-2 transition-all duration-200 ease-in-out last:border-b-0 hover:bg-neutral-100/50"
      tabindex="0"
      @mouseenter="hoveredMessage = item"
      @mouseleave="hoveredMessage = null"
      @keydown.enter="copyMessageLink(item)"
    >
      <Avatar
        :name="item.fromName"
        size="sm"
      />
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm text-primary-900 font-semibold">
          {{ item.fromName }}
        </div>
        <div class="break-words text-sm text-complementary-500" v-html="highlightKeyword(item.content, props.keyword)" />
      </div>
      <div
        v-if="hoveredMessage === item"
        class="absolute bottom-0.5 right-0.5 flex items-center gap-0.5 rounded bg-background/50 px-1 py-0.5 text-[10px] text-complementary-500 opacity-50"
      >
        <span>{{ copied ? '已复制' : '按下复制消息链接' }}</span>
        <span v-if="!copied" class="i-lucide-corner-down-left h-2.5 w-2.5" />
        <span v-else class="i-lucide-check h-2.5 w-2.5" />
      </div>
    </li>
  </ul>
</template>
