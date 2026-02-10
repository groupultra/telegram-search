<script setup lang="ts">
import type { CoreMessage } from '@tg-search/core/types'

import { formatMessageTimestamp } from '@tg-search/client'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import EntityAvatar from '../avatar/EntityAvatar.vue'
import Button from '../ui/Button/Button.vue'
import MediaRenderer from './media/MediaRenderer.vue'

defineProps<{
  message: CoreMessage
}>()

const { t } = useI18n()

function copyMessageLink(message: CoreMessage) {
  navigator.clipboard.writeText(`https://t.me/c/${message.chatId}/${message.platformMessageId}`)
  toast.success(t('messages.copied'))
}

function copyMessageDeepLink(message: CoreMessage) {
  navigator.clipboard.writeText(`tg://privatepost?channel=${message.chatId}&post=${message.platformMessageId}`)
  toast.success(t('messages.copied'))
}

function copyMessageText(message: CoreMessage) {
  navigator.clipboard.writeText(message.content)
  toast.success(t('messages.copied'))
}
</script>

<template>
  <div class="group mx-3 my-1 flex items-start gap-3 rounded-xl p-3 transition-all duration-200 md:mx-4 md:gap-4 hover:bg-accent/50">
    <div class="shrink-0 pt-0.5">
      <EntityAvatar
        :id="message.fromId"
        entity="other"
        entity-type="user"
        :name="message.fromName"
        size="md"
      />
    </div>
    <div class="min-w-0 flex-1">
      <div class="mb-1.5 flex items-baseline gap-2">
        <span class="truncate text-sm text-foreground font-semibold">{{ message.fromName }}</span>
        <span class="shrink-0 text-xs text-muted-foreground">{{ formatMessageTimestamp(message.platformTimestamp) }}</span>
      </div>

      <div class="prose prose-sm max-w-none text-foreground/90">
        <MediaRenderer :message="message" />
      </div>

      <!-- Message ID badge (hidden by default, shown on hover) -->
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
          v-if="message.fromId.startsWith('-100')"
          icon="i-lucide-external-link"
          size="sm"
          class="h-3 w-3 shrink-0 px-0 opacity-50 transition-opacity hover:opacity-100"
          @click="copyMessageDeepLink(message)"
        />
      </div>
    </div>
  </div>
</template>
