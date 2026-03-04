<script setup lang="ts">
import type { CoreMessage } from '@tg-search/core/types'

import { formatMessageTimestamp, useChatStore } from '@tg-search/client'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import EntityAvatar from '../avatar/EntityAvatar.vue'
import Button from '../ui/Button/Button.vue'
import MediaRenderer from './media/MediaRenderer.vue'

import { getMessageLink, getUserProfileLink } from '../../utils/telegram-links'

const props = defineProps<{
  message: CoreMessage
}>()

const { t } = useI18n()
const chatStore = useChatStore()

const currentChat = computed(() => chatStore.getChat(props.message.chatId))

const messageTelegramLink = computed(() => {
  if (!currentChat.value)
    return null
  return getMessageLink(currentChat.value, props.message.platformMessageId)
})

const senderProfileLink = computed(() => {
  return getUserProfileLink(props.message.fromId)
})

function copyMessageLink(message: CoreMessage) {
  navigator.clipboard.writeText(`https://t.me/c/${message.chatId}/${message.platformMessageId}`)
  toast.success(t('messages.copied'))
}

function copyMessageText(message: CoreMessage) {
  navigator.clipboard.writeText(message.content)
  toast.success(t('messages.copied'))
}

function openInTelegram() {
  const link = messageTelegramLink.value
  if (link) {
    window.open(link.tgLink, '_self')
  }
}
</script>

<template>
  <div class="group mx-3 my-1 flex items-start gap-3 rounded-xl p-3 transition-all duration-200 md:mx-4 md:gap-4 hover:bg-accent/50">
    <a
      class="shrink-0 cursor-pointer pt-0.5"
      :href="senderProfileLink.tgLink"
      :title="t('messages.openProfileInTelegram')"
    >
      <EntityAvatar
        :id="message.fromId"
        entity="other"
        entity-type="user"
        :name="message.fromName"
        size="md"
      />
    </a>
    <div class="min-w-0 flex-1">
      <div class="mb-1.5 flex items-baseline gap-2">
        <span class="truncate text-sm text-foreground font-semibold">{{ message.fromName }}</span>
        <span class="shrink-0 text-xs text-muted-foreground">{{ formatMessageTimestamp(message.platformTimestamp) }}</span>
      </div>

      <div class="prose prose-sm max-w-none text-foreground/90">
        <MediaRenderer :message="message" />
      </div>

      <!-- Message ID badge and actions (hidden by default, shown on hover) -->
      <div class="mt-1.5 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
        <span class="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          <span class="i-lucide-hash mr-1 h-3 w-3" />
          {{ message.platformMessageId }}
        </span>
        <Button
          icon="i-lucide-copy"
          size="sm"
          class="h-3 w-3 shrink-0 px-0 opacity-50 transition-opacity hover:opacity-100"
          @click="copyMessageText(message)"
        />
        <Button
          icon="i-lucide-link"
          size="sm"
          class="h-3 w-3 shrink-0 px-0 opacity-50 transition-opacity hover:opacity-100"
          @click="copyMessageLink(message)"
        />
        <Button
          v-if="messageTelegramLink"
          icon="i-lucide-external-link"
          size="sm"
          class="h-3 w-3 shrink-0 px-0 opacity-50 transition-opacity hover:opacity-100"
          :title="t('messages.openInTelegram')"
          @click="openInTelegram"
        />
      </div>
    </div>
  </div>
</template>
