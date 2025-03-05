<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useChats } from '../../../apis/useChats'
import { useMultiSync } from '../../../composables/useMultiSync'

const { t } = useI18n()
const { chats } = useChats()
const { getSyncStatus, cancelSync } = useMultiSync()

const syncStatus = ref<Array<{
  chatId: number
  status: string
  lastError?: string
}>>([])

function getChatTitle(chatId: number) {
  return chats.value.find(c => c.id === chatId)?.title || chatId
}

let statusInterval: NodeJS.Timeout

async function updateStatus() {
  const activeChats = syncStatus.value
    .filter(s => s.status === 'running' || s.status === 'queued')
    .map(s => s.chatId)

  if (activeChats.length === 0)
    return

  for (const chatId of activeChats) {
    const status = await getSyncStatus(chatId)
    if (status) {
      const index = syncStatus.value.findIndex(s => s.chatId === chatId)
      if (index !== -1) {
        // Convert null to undefined for lastError to match the type
        syncStatus.value[index] = {
          chatId: status.chatId,
          status: status.status,
          lastError: status.lastError ?? undefined,
        }
      }
    }
  }
}

onMounted(() => {
  statusInterval = setInterval(updateStatus, 1000)
})

onUnmounted(() => {
  clearInterval(statusInterval)
})
</script>

<template>
  <div class="space-y-4">
    <h3 class="text-lg font-medium">
      {{ t('component.sync_command.sync_status') }}
    </h3>

    <div class="space-y-2">
      <div
        v-for="status in syncStatus"
        :key="status.chatId"
        class="border rounded-lg p-4"
        :class="{
          'border-blue-500 bg-blue-50': status.status === 'running',
          'border-green-500 bg-green-50': status.status === 'completed',
          'border-red-500 bg-red-50': status.status === 'failed',
        }"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium">
              {{ getChatTitle(status.chatId) }}
            </p>
            <p class="text-sm text-gray-500">
              {{ t(`component.sync_command.status.${status.status}`) }}
            </p>
          </div>
          <button
            v-if="status.status === 'running'"
            class="text-red-600 hover:text-red-700"
            @click="cancelSync(status.chatId)"
          >
            {{ t('pages.settings.cancel') }}
          </button>
        </div>

        <div v-if="status.lastError" class="mt-2 text-sm text-red-600">
          {{ status.lastError }}
        </div>
      </div>
    </div>
  </div>
</template>
