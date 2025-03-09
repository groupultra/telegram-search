<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useChats } from '../apis/useChats'

// Initialize API client and router
const { loading, error, exportedChats, loadChats } = useChats()
const router = useRouter()
const { t } = useI18n()
// Computed properties for filtered and categorized chats
const privateChats = computed(() => exportedChats.value.filter(chat => chat.type === 'user'))
const groupChats = computed(() => exportedChats.value.filter(chat => chat.type === 'group'))
const channelChats = computed(() => exportedChats.value.filter(chat => chat.type === 'channel'))

// Navigate to chat view
function goToChat(chatId: number) {
  router.push(`/chat/${chatId}`)
}

// Load chats on component mount
onMounted(async () => {
  await loadChats()
})
</script>

<template>
  <div class="p-4">
    <h1 class="mb-4 text-2xl font-bold">
      {{ t('pages.index.chats') }}
    </h1>

    <!-- Loading state -->
    <div v-if="loading" class="text-gray-500">
      {{ t('pages.index.loading') }}
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="text-red-500">
      {{ error }}
    </div>

    <!-- Chat list -->
    <div v-else class="space-y-6">
      <!-- Private Chats -->
      <div v-if="privateChats.length > 0">
        <h2 class="mb-2 text-xl font-semibold">
          {{ t('pages.index.private_chats') }}
        </h2>
        <div class="space-y-2">
          <div
            v-for="chat in privateChats"
            :key="chat.id"
            class="cursor-pointer rounded-lg bg-gray-100 p-4 transition-colors dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
            @click="goToChat(chat.id)"
          >
            <h2 class="text-left text-lg font-semibold">
              {{ chat.title }}
              <span class="ml-2 text-xs text-gray-500 font-normal">{{ t('pages.index.id', { id: chat.id }) }}</span>
            </h2>
            <div class="mt-2 flex items-center gap-4 text-sm text-gray-500">
              <span>{{ t('pages.index.messages_count', { count: chat.messageCount }) }}</span>
              <span v-if="chat.lastMessageDate">
                {{ t('pages.index.last_message', { date: new Date(chat.lastMessageDate).toLocaleString() }) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Group Chats -->
      <div v-if="groupChats.length > 0">
        <h2 class="mb-2 text-xl font-semibold">
          {{ t('pages.index.group_chats') }}
        </h2>
        <div class="space-y-2">
          <div
            v-for="chat in groupChats"
            :key="chat.id"
            class="cursor-pointer rounded-lg bg-gray-100 p-4 transition-colors dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
            @click="goToChat(chat.id)"
          >
            <h2 class="text-left text-lg font-semibold">
              {{ chat.title }}
              <span class="ml-2 text-xs text-gray-500 font-normal">{{ t('pages.index.id', { id: chat.id }) }}</span>
            </h2>
            <div class="mt-2 flex items-center gap-4 text-sm text-gray-500">
              <span>{{ t('pages.index.messages_count', { count: chat.messageCount }) }}</span>
              <span v-if="chat.lastMessageDate">
                {{ t('pages.index.last_message', { date: new Date(chat.lastMessageDate).toLocaleString() }) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Channel Chats -->
      <div v-if="channelChats.length > 0">
        <h2 class="mb-2 text-xl font-semibold">
          {{ t('pages.index.channels') }}
        </h2>
        <div class="space-y-2">
          <div
            v-for="chat in channelChats"
            :key="chat.id"
            class="cursor-pointer rounded-lg bg-gray-100 p-4 transition-colors dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
            @click="goToChat(chat.id)"
          >
            <h2 class="text-left text-lg font-semibold">
              {{ chat.title }}
              <span class="ml-2 text-xs text-gray-500 font-normal">{{ t('pages.index.id', { id: chat.id }) }}</span>
            </h2>
            <div class="mt-2 flex items-center gap-4 text-sm text-gray-500">
              <span>{{ t('pages.index.messages_count', { count: chat.messageCount }) }}</span>
              <span v-if="chat.lastMessageDate">
                {{ t('pages.index.last_message', { date: new Date(chat.lastMessageDate).toLocaleString() }) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="exportedChats.length === 0" class="text-gray-500">
        {{ t('pages.index.no_chats_found') }}
      </div>
    </div>
  </div>
</template>
