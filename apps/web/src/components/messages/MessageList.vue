<script setup lang="ts">
import type { CoreMessage } from '@tg-search/core/types'

import { formatMessageTimestamp } from '@tg-search/client'
import { useClipboard } from '@vueuse/core'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import EntityAvatar from '../avatar/EntityAvatar.vue'
import ContextMenu from '../ui/ContextMenu.vue'

const props = defineProps<{
  messages: CoreMessage[]
  keyword: string
}>()
const { t } = useI18n()
const router = useRouter()
const hoveredMessage = ref<CoreMessage | null>(null)
const { copy } = useClipboard()

const contextMenuOpen = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuMessage = ref<CoreMessage | null>(null)

const contextMenuItems = computed(() => [
  {
    label: t('messages.copyMessageLink'),
    icon: 'i-lucide-link',
    action: () => {
      if (contextMenuMessage.value) {
        copyMessageLink(contextMenuMessage.value)
        toast.success(t('messages.copied'))
      }
    },
  },
  {
    label: t('messages.openInChat'),
    icon: 'i-lucide-external-link',
    action: () => {
      if (contextMenuMessage.value)
        navigateToMessage(contextMenuMessage.value)
    },
  },
])

function highlightKeyword(text: string, keyword: string) {
  if (!keyword)
    return text
  const regex = new RegExp(`(${keyword})`, 'gi')
  return text.replace(regex, '<span class="bg-yellow-200 dark:bg-yellow-800">$1</span>')
}

function copyMessageLink(message: CoreMessage) {
  copy(`https://t.me/c/${message.chatId}/${message.platformMessageId}`)
}

function navigateToMessage(message: CoreMessage) {
  router.push({
    path: `/chat/${message.chatId}`,
    query: {
      messageId: message.platformMessageId,
      messageUuid: message.uuid,
    },
  })
}

function handleContextMenu(event: MouseEvent, message: CoreMessage) {
  event.preventDefault()
  contextMenuMessage.value = message
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  contextMenuOpen.value = true
}

function handleLongPress(event: TouchEvent, message: CoreMessage) {
  event.preventDefault()
  const touch = event.touches[0]
  contextMenuMessage.value = message
  contextMenuX.value = touch.clientX
  contextMenuY.value = touch.clientY
  contextMenuOpen.value = true
}
</script>

<template>
  <ul class="h-full flex flex-col animate-fade-in overflow-y-auto md:max-h-[540px]">
    <li
      v-for="item in props.messages"
      :key="item.uuid"
      class="group animate-slide-in relative flex cursor-pointer items-start gap-3 border-b p-3 transition-all duration-200 ease-in-out last:border-b-0 dark:border-gray-700 active:bg-neutral-200/50 hover:bg-neutral-100/50 dark:active:bg-gray-700/50 dark:hover:bg-gray-800/50"
      tabindex="0"
      @mouseenter="hoveredMessage = item"
      @mouseleave="hoveredMessage = null"
      @keydown.enter="copyMessageLink(item)"
      @click="navigateToMessage(item)"
      @contextmenu="handleContextMenu($event, item)"
      @touchstart.passive="handleLongPress($event, item)"
    >
      <div class="shrink-0 pt-0.5">
        <EntityAvatar
          :id="item.fromId"
          entity="other"
          entity-type="user"
          :name="item.fromName"
          size="md"
        />
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-baseline gap-2">
          <span class="truncate text-sm text-gray-900 font-semibold dark:text-gray-100">
            {{ item.fromName }}
          </span>
          <span class="shrink-0 text-xs text-gray-500 dark:text-gray-400">
            {{ formatMessageTimestamp(item.platformTimestamp) }}
          </span>
        </div>
        <div class="mt-1 whitespace-pre-wrap break-words text-sm text-gray-600 dark:text-gray-400" v-html="highlightKeyword(item.content, props.keyword)" />
        <div class="mt-1 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <span class="i-lucide-hash h-3 w-3" />
          <span>{{ item.platformMessageId }}</span>
        </div>
      </div>
      <button
        class="shrink-0 rounded-lg p-2 opacity-0 transition-all hover:bg-accent group-hover:opacity-100"
        @click.stop="handleContextMenu($event, item)"
      >
        <span class="i-lucide-more-vertical h-4 w-4" />
      </button>
    </li>
  </ul>

  <ContextMenu
    v-model:open="contextMenuOpen"
    :items="contextMenuItems"
    :x="contextMenuX"
    :y="contextMenuY"
  />
</template>
