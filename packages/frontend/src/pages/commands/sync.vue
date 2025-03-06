<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { useChats } from '../../apis/useChats'
import MultiSyncStatus from '../../components/commands/sync/MultiSyncStatus.vue'
import SelectDropdown from '../../components/ui/SelectDropdown.vue'
import Pagination from '../../components/ui/Pagination.vue'
import { useMultiSync } from '../../composables/useMultiSync'
import { useSession } from '../../composables/useSession'

const { t } = useI18n()
const router = useRouter()
const { chats, loadChats } = useChats()
const { executeMultiSync } = useMultiSync()
const { checkConnection, isConnected } = useSession()

const selectedChats = ref<number[]>([])
const priorities = ref<Record<number, number>>({})
const showPriorityDialog = ref(false)
const showConnectButton = ref(false)

// Grid selector states
const selectedType = ref<string>('user')
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = 12

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

// Filtered options based on type and search query
const filteredOptions = computed(() => {
  let filtered = gridOptions.value

  // Filter by type if type is selected
  if (selectedType.value) {
    filtered = filtered.filter(option => option.type === selectedType.value)
  }

  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(option =>
      option.title.toLowerCase().includes(query)
      || option.subtitle?.toLowerCase().includes(query)
      || option.id.toString().includes(query),
    )
  }

  // Sort by selection status
  return filtered.sort((a, b) => {
    const aSelected = selectedChats.value.includes(a.id)
    const bSelected = selectedChats.value.includes(b.id)
    if (aSelected && !bSelected)
      return -1
    if (!aSelected && bSelected)
      return 1
    return 0
  })
})

// Paginated options
const paginatedOptions = computed(() => {
  const startIndex = (currentPage.value - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  return filteredOptions.value.slice(startIndex, endIndex)
})

// Total pages
const totalPages = computed(() =>
  Math.ceil(filteredOptions.value.length / itemsPerPage),
)

// Selected count
const selectedCount = computed(() => selectedChats.value.length)

function isSelected(id: number): boolean {
  return selectedChats.value.includes(id)
}

function toggleSelection(id: number): void {
  const index = selectedChats.value.indexOf(id)
  if (index === -1)
    selectedChats.value.push(id)
  else
    selectedChats.value.splice(index, 1)
}

function changePage(page: number): void {
  currentPage.value = page
}

function getChatTitle(chatId: number) {
  return chats.value.find(c => c.id === chatId)?.title || chatId
}

async function startSync() {
  // Check if connected to Telegram
  if (!isConnected.value) {
    toast.error(t('component.sync_command.not_connect'))
    return
  }

  if (selectedChats.value.length === 0)
    return

  showPriorityDialog.value = true
}

async function confirmPriorities() {
  showPriorityDialog.value = false
  const toastId = toast.loading(t('component.sync_command.prepare_sync_'))

  try {
    await executeMultiSync({
      chatIds: selectedChats.value,
      priorities: priorities.value,
    })
    toast.success(t('component.sync_command.sync_success'), { id: toastId })
  }
  catch (error) {
    toast.error(t('component.sync_command.sync_failure', { error: error instanceof Error ? error.message : '未知错误' }), { id: toastId })
    console.error('Failed to start sync:', error)
  }
}

// 跳转到登录页
function goToLogin(): void {
  const currentPath = router.currentRoute.value.fullPath
  router.push(`/login?redirect=${encodeURIComponent(currentPath)}`)
}

// Reset page when filters change
watch([selectedType, searchQuery], () => {
  currentPage.value = 1
})

onMounted(async () => {
  await loadChats()
  const connected = await checkConnection(false) // 不自动跳转到登录页
  if (!connected) {
    // 如果未连接，显示连接按钮，而不是自动跳转
    showConnectButton.value = true
  }
})
</script>

<template>
  <div class="space-y-4">
    <!-- 未连接Telegram时的提示 -->
    <div v-if="!isConnected && showConnectButton" class="mb-4 rounded-md bg-blue-50 p-4 dark:bg-blue-900/30">
      <div class="flex">
        <div class="flex-shrink-0">
          <div class="i-lucide-information h-5 w-5 text-blue-400" aria-hidden="true" />
        </div>
        <div class="ml-3 flex-1 md:flex md:justify-between">
          <p class="text-sm text-blue-700 dark:text-blue-300">
            {{ t('component.sync_command.need_connect') }}
          </p>
          <p class="mt-3 text-sm md:ml-6 md:mt-0">
            <button
              class="whitespace-nowrap text-blue-700 font-medium dark:text-blue-300 hover:text-blue-600 dark:hover:text-blue-200"
              @click="goToLogin"
            >
              {{ t('component.sync_command.connect_to_telegram') }}
              <span aria-hidden="true"> &rarr;</span>
            </button>
          </p>
        </div>
      </div>
    </div>

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
          :disabled="selectedChats.length === 0 || !isConnected"
          @click="startSync"
        >
          {{ t('component.sync_command.start_sync') }}
        </button>
      </div>
    </div>

    <div class="space-y-4">
      <!-- Filters -->
      <div class="flex flex-col items-start gap-4 md:flex-row md:items-end">
        <!-- Type Selection -->
        <div class="w-full md:w-48">
          <SelectDropdown
            v-model="selectedType"
            :options="chatTypeOptions"
            :label="t('component.grid_selector.type')"
          />
        </div>

        <!-- Search Input -->
        <div class="flex-1">
          <input
            v-model="searchQuery"
            type="text"
            class="w-full border border-gray-300 rounded-md px-4 py-2 dark:border-gray-600 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
            :placeholder="t('component.export_command.placeholder_search')"
          >
        </div>
      </div>

      <!-- Grid List -->
      <TransitionGroup
        name="grid-list"
        tag="div"
        class="grid gap-4 lg:grid-cols-3 md:grid-cols-2"
      >
        <button
          v-for="option in paginatedOptions"
          :key="option.id"
          class="grid-item relative w-full flex cursor-pointer items-center border rounded-lg p-4 text-left space-x-3 hover:shadow-md"
          :class="{
            'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md selected': isSelected(option.id),
            'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600': !isSelected(option.id),
          }"
          @click="toggleSelection(option.id)"
        >
          <div class="min-w-0 flex-1">
            <div class="focus:outline-none">
              <p class="flex items-center gap-2 text-sm text-gray-900 font-medium dark:text-gray-100">
                {{ option.title }}
                <TransitionGroup name="fade">
                  <span v-if="isSelected(option.id)" :key="`check${option.id}`" class="text-blue-500 dark:text-blue-400">
                    <div class="i-lucide-circle-check h-4 w-4" />
                  </span>
                </TransitionGroup>
              </p>
              <p v-if="option.subtitle" class="truncate text-sm text-gray-500 dark:text-gray-400">
                {{ option.subtitle }}
              </p>
            </div>
          </div>
        </button>
      </TransitionGroup>

      <!-- Pagination -->
      <Pagination
        v-if="totalPages > 1"
        v-model="currentPage"
        :total="totalPages"
        theme="blue"
      />

      <!-- No Results Message -->
      <div v-if="filteredOptions.length === 0" class="py-8 text-center text-gray-500 dark:text-gray-400">
        {{ t('pages.index.not_chats_found') }}
      </div>
    </div>

    <!-- Priority Settings Dialog -->
    <Teleport to=".dialog-wrapper">
      <Dialog v-model="showPriorityDialog">
        <div class="space-y-4">
          <div class="flex items-center justify-between border-b border-gray-200 pb-4 dark:border-gray-700">
            <h3 class="text-lg font-medium dark:text-gray-100">
              {{ t('component.sync_command.set_priorities') }}
            </h3>
            <button
              class="text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400"
              @click="showPriorityDialog = false"
            >
              <div class="i-lucide-close h-5 w-5" />
            </button>
          </div>

          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('component.sync_command.priority_tip') }}
          </p>

          <div class="max-h-[60vh] overflow-y-auto space-y-3">
            <div
              v-for="chatId in selectedChats"
              :key="chatId"
              class="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50"
            >
              <span class="dark:text-gray-200">{{ getChatTitle(chatId) }}</span>
              <input
                v-model="priorities[chatId]"
                type="number"
                min="0"
                max="100"
                class="w-24 border-gray-300 rounded-md dark:border-gray-600 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 focus:ring-blue-500"
              >
            </div>
          </div>

          <div class="flex justify-end border-t border-gray-200 pt-4 space-x-3 dark:border-gray-700">
            <button
              class="border border-gray-300 rounded-md bg-white px-4 py-2 text-sm text-gray-700 font-medium shadow-sm dark:border-gray-600 dark:bg-gray-800 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
              @click="showPriorityDialog = false"
            >
              {{ t('pages.settings.cancel') }}
            </button>
            <button
              class="border border-transparent rounded-md bg-blue-500 px-4 py-2 text-sm text-white font-medium shadow-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              @click="confirmPriorities"
            >
              {{ t('pages.settings.confirm') }}
            </button>
          </div>
        </div>
      </Dialog>
    </Teleport>

    <MultiSyncStatus />
  </div>
</template>

<style scoped>
.grid-item {
  transition: all 0.3s ease-in-out;
}

.grid-item.selected {
  transform: scale(1.02);
}

/* Grid list animations */
.grid-list-move,
.grid-list-enter-active,
.grid-list-leave-active {
  transition: all 0.3s ease;
}

.grid-list-enter-from,
.grid-list-leave-to {
  opacity: 0;
  transform: translateY(30px);
}

.grid-list-leave-active {
  position: absolute;
}

/* Checkmark animations */
.fade-enter-active,
.fade-leave-active {
  transition: all 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

/* Hover effects */
.grid-item:hover:not(.selected) {
  transform: translateY(-2px);
}

.grid-item:active {
  transform: scale(0.98);
}
</style>
