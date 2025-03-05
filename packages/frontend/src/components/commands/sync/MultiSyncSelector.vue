<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useChats } from '../../../apis/useChats'
import { useMultiSync } from '../../../composables/useMultiSync'
import GridSelector from '../../ui/GridSelector.vue'

const { t } = useI18n()
const { chats, loadChats } = useChats()
const { executeMultiSync } = useMultiSync()

const selectedChats = ref<number[]>([])
const priorities = ref<Record<number, number>>({})
const showPriorityDialog = ref(false)

// Chat type options
const chatTypeOptions = [
  { label: t('component.export_command.user_chat'), value: 'user' },
  { label: t('component.export_command.group_chat'), value: 'group' },
  { label: t('component.export_command.channels_chat'), value: 'channel' },
]

// Transform chats to grid options
const gridOptions = computed(() => chats.value.map(chat => ({
  id: chat.id,
  title: chat.title,
  subtitle: `ID: ${chat.id}`,
  type: chat.type,
})))

// 计算选中的会话数量
const selectedCount = computed(() => selectedChats.value.length)

function getChatTitle(chatId: number) {
  return chats.value.find(c => c.id === chatId)?.title || chatId
}

async function startSync() {
  if (selectedChats.value.length === 0)
    return

  showPriorityDialog.value = true
}

async function confirmPriorities() {
  showPriorityDialog.value = false

  try {
    await executeMultiSync({
      chatIds: selectedChats.value,
      priorities: priorities.value,
    })
  }
  catch (error) {
    console.error('Failed to start sync:', error)
  }
}

onMounted(async () => {
  await loadChats()
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-medium">
        {{ t('component.sync_command.select_chats') }}
      </h3>
      <div class="flex items-center gap-2">
        <span class="text-sm text-gray-500">
          {{ t('component.sync_command.selected_count', { count: selectedCount }) }}
        </span>
        <button
          class="rounded-md bg-blue-500 px-4 py-2 text-white disabled:cursor-not-allowed hover:bg-blue-600 disabled:opacity-50"
          :disabled="selectedChats.length === 0"
          @click="startSync"
        >
          {{ t('component.sync_command.start_sync') }}
        </button>
      </div>
    </div>

    <GridSelector
      v-model="selectedChats"
      :options="gridOptions"
      :type-options="chatTypeOptions"
      :search-placeholder="t('component.export_command.placeholder_search')"
      :no-results-text="t('pages.index.not_chats_found')"
    />

    <!-- Priority Settings Dialog -->
    <Dialog v-model="showPriorityDialog">
      <div class="space-y-4">
        <h3 class="text-lg font-medium dark:text-gray-100">
          {{ t('component.sync_command.set_priorities') }}
        </h3>
        <div class="space-y-2">
          <div
            v-for="chatId in selectedChats"
            :key="chatId"
            class="flex items-center justify-between"
          >
            <span class="dark:text-gray-200">{{ getChatTitle(chatId) }}</span>
            <input
              v-model="priorities[chatId]"
              type="number"
              min="0"
              max="100"
              class="w-20 border-gray-300 rounded-md dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
          </div>
        </div>
        <div class="flex justify-end space-x-2">
          <button
            class="rounded-md bg-gray-500 px-4 py-2 text-white hover:bg-gray-600"
            @click="showPriorityDialog = false"
          >
            {{ t('pages.settings.cancel') }}
          </button>
          <button
            class="rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
            @click="confirmPriorities"
          >
            {{ t('pages.settings.confirm') }}
          </button>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.chat-item {
  transition: all 0.3s ease-in-out;
}

.chat-item.selected {
  transform: scale(1.02);
}

/* 列表项移动动画 */
.chat-list-move,
.chat-list-enter-active,
.chat-list-leave-active {
  transition: all 0.3s ease;
}

.chat-list-enter-from,
.chat-list-leave-to {
  opacity: 0;
  transform: translateY(30px);
}

.chat-list-leave-active {
  position: absolute;
}

/* 勾选图标淡入淡出动画 */
.fade-enter-active,
.fade-leave-active {
  transition: all 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

/* 移除之前的动画，因为我们现在使用 Vue 的 transition 系统 */
.transform {
  animation: none;
}

button:not(.transform) {
  animation: none;
}

/* 悬停效果 */
.chat-item:hover:not(.selected) {
  transform: translateY(-2px);
}

/* 点击效果 */
.chat-item:active {
  transform: scale(0.98);
}
</style>
