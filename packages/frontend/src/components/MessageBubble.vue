<!-- Message bubble component for displaying PublicMessage -->
<script setup lang="ts">
import type { TelegramMessage } from '@tg-search/core'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  message: TelegramMessage & { highlight?: boolean }
  isSelf?: boolean
}>()

const emit = defineEmits<{
  (e: 'jumpToMessage', messageId: number): void
}>()

const { t } = useI18n()

// Get avatar letter from name
const avatarLetter = computed(() => {
  const name = props.message.fromName || 'Unknown'
  return name.charAt(0).toUpperCase()
})

// Get avatar background color based on name
const avatarColor = computed(() => {
  if (props.message.fromAvatar?.type === 'emoji' && props.message.fromAvatar.color) {
    return props.message.fromAvatar.color
  }

  // Generate a consistent color based on the user name
  const name = props.message.fromName || 'Unknown'
  // Monet-inspired color palette with lower saturation
  const colors = [
    'bg-[#8BA7B5]', // 莫奈蓝，水面的柔和蓝色
    'bg-[#B5A088]', // 温暖的米褐色
    'bg-[#899F84]', // 柔和的橄榄绿
    'bg-[#B58D7C]', // 淡赭石色
    'bg-[#8E9FA8]', // 雾蓝色
    'bg-[#A89B8C]', // 温和的灰褐色
    'bg-[#9E8B83]', // 柔和的玫瑰褐色
    'bg-[#7F938F]', // 青灰色
  ]
  const index = name.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) % colors.length
  return colors[index]
})

// Get bubble position class
const bubblePositionClass = computed(() => {
  return props.isSelf ? 'flex flex-row-reverse items-start' : 'flex items-start'
})

// Get bubble content class
const bubbleContentClass = computed(() => {
  const classes = ['relative', 'max-w-[70%]', 'px-5', 'py-3', 'rounded-2xl', 'shadow-sm']

  if (props.isSelf) {
    classes.push('bg-[#8BA7B5]', 'text-white', 'ml-16')
    // Add right triangle
    classes.push('after:absolute', 'after:right-[-8px]', 'after:top-[18px]', 'after:mt-[-6px]')
    classes.push('after:border-[6px]', 'after:border-transparent')
    classes.push('after:border-l-[#8BA7B5]', 'after:border-l-[8px]')
  }
  else {
    classes.push('bg-gray-100', 'dark:bg-gray-800', 'mr-16')
    // Add left triangle
    classes.push('after:absolute', 'after:left-[-8px]', 'after:top-[18px]', 'after:mt-[-6px]')
    classes.push('after:border-[6px]', 'after:border-transparent')
    classes.push('after:border-r-gray-100', 'dark:after:border-r-gray-800', 'after:border-r-[8px]')
  }

  if (props.message.highlight) {
    classes.push('highlight')
  }

  return classes
})

// Format time to include date and time
function formatTime(date: Date | string): string {
  const dateObj = date instanceof Date ? date : new Date(date)
  return dateObj.toLocaleString('default', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Format file size to human readable string
function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit++
  }
  return `${size.toFixed(1)} ${units[unit]}`
}
</script>

<template>
  <div class="message-bubble mb-6" :class="bubblePositionClass">
    <!-- Avatar -->
    <div class="mx-4 h-10 w-10 flex-shrink-0">
      <div
        v-if="message.fromAvatar?.type === 'emoji'"
        class="h-10 w-10 flex items-center justify-center rounded-full text-xl"
        :style="{ backgroundColor: message.fromAvatar.color || '#e5e7eb' }"
      >
        {{ message.fromAvatar.value }}
      </div>
      <img
        v-else-if="message.fromAvatar?.type === 'photo'"
        :src="message.fromAvatar.value"
        :alt="message.fromName || undefined"
        class="h-10 w-10 rounded-full object-cover"
      >
      <div
        v-else
        class="h-10 w-10 flex items-center justify-center rounded-full text-lg text-white font-medium"
        :class="avatarColor"
      >
        {{ avatarLetter }}
      </div>
    </div>

    <!-- Message content -->
    <div :class="bubbleContentClass">
      <!-- Sender name -->
      <div class="mb-2 text-sm font-medium" :class="{ 'text-blue-500 dark:text-blue-400': !isSelf }">
        {{ message.fromName || 'Unknown' }}
      </div>

      <!-- Text content -->
      <div class="whitespace-pre-wrap break-words text-left leading-relaxed">
        <template v-if="message.content">
          {{ message.content }}
        </template>
        <template v-else-if="message.mediaInfo">
          <span class="text-gray-500 italic">
            <template v-if="message.mediaInfo.type === 'photo'">[{{ t('component.message_bubble.photo') }}]</template>
            <template v-else-if="message.mediaInfo.type === 'video'">[{{ t('component.message_bubble.video') }}]</template>
            <template v-else-if="message.mediaInfo.type === 'document'">[{{ t('component.message_bubble.document') }}]</template>
            <template v-else-if="message.mediaInfo.type === 'sticker'">[{{ t('component.message_bubble.sticker') }}]</template>
            <template v-else>[{{ t('component.message_bubble.media') }}]</template>
          </span>
        </template>
      </div>

      <!-- Media content -->
      <div v-if="message.mediaInfo" class="mt-3">
        <!-- Photo -->
        <img
          v-if="message.mediaInfo.type === 'photo'"
          :src="`/api/media/${message.chatId}/${message.id}`"
          :alt="message.mediaInfo.fileName || 'Photo'"
          class="max-w-full rounded-lg"
          :style="{
            width: message.mediaInfo.width ? `${message.mediaInfo.width}px` : 'auto',
            height: message.mediaInfo.height ? `${message.mediaInfo.height}px` : 'auto',
          }"
        >

        <!-- Video -->
        <video
          v-else-if="message.mediaInfo.type === 'video'"
          :src="`/api/media/${message.chatId}/${message.id}`"
          :poster="message.mediaInfo.thumbnail ? `/api/media/${message.chatId}/${message.id}/thumbnail` : undefined"
          controls
          class="max-w-full rounded-lg"
          :style="{
            width: message.mediaInfo.width ? `${message.mediaInfo.width}px` : 'auto',
            height: message.mediaInfo.height ? `${message.mediaInfo.height}px` : 'auto',
          }"
        />

        <!-- Document -->
        <div
          v-else-if="message.mediaInfo.type === 'document'"
          class="flex items-center rounded bg-gray-50 p-3 space-x-3 dark:bg-gray-700"
        >
          <Icon icon="lucide:document" class="h-6 w-6" />
          <div class="flex-1">
            <div class="text-sm font-medium">
              {{ message.mediaInfo.fileName || 'Document' }}
            </div>
            <div class="mt-1 text-xs text-gray-500">
              {{ message.mediaInfo.fileSize ? formatFileSize(message.mediaInfo.fileSize) : '' }}
            </div>
          </div>
          <a
            :href="`/api/media/${message.chatId}/${message.id}`"
            download
            class="rounded bg-gray-200 px-3 py-1.5 text-sm dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500"
          >
            {{ t('component.message_bubble.download') }}
          </a>
        </div>

        <!-- Sticker -->
        <img
          v-else-if="message.mediaInfo.type === 'sticker'"
          :src="`/api/media/${message.chatId}/${message.id}`"
          :alt="message.mediaInfo.fileName || 'Sticker'"
          class="max-h-[238px] max-w-[238px] rounded-lg object-contain"
        >
      </div>

      <!-- Message info -->
      <div class="mt-2 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
        <span>{{ formatTime(message.createdAt) }}</span>
        <span class="inline-flex items-center">
          <Icon icon="lucide:id" class="mr-1 h-4 w-4" />
          {{ t('component.message_bubble.id', { id: message.id }) }}
        </span>
        <span v-if="message.views" class="inline-flex items-center">
          <Icon icon="lucide:view" class="mr-1 h-4 w-4" />
          {{ message.views }}
        </span>
        <span v-if="message.forwards" class="inline-flex items-center">
          <Icon icon="lucide:share" class="mr-1 h-4 w-4" />
          {{ message.forwards }}
        </span>
        <span
          v-if="message.replyToId"
          class="inline-flex cursor-pointer items-center hover:underline"
          @click="emit('jumpToMessage', message.replyToId)"
        >
          <Icon icon="lucide:reply" class="mr-1 h-4 w-4" />
          {{ message.replyToId }}
        </span>
        <span v-if="message.forwardFromChatId" class="inline-flex items-center">
          <Icon icon="lucide:arrow-right" class="mr-1 h-4 w-4" />
          {{ message.forwardFromChatId }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.message-bubble {
  @apply w-full;
}

.highlight {
  @apply ring-2 ring-blue-500 dark:ring-blue-400 !important;
}
</style>
