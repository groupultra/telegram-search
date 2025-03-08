<!-- Chat selector component -->
<script setup lang="ts">
import type { TelegramChat } from '@tg-search/core'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useChatTypeOptions } from '../../composables/useOptions'
import { usePagination } from '../../composables/usePagination'
import Pagination from '../ui/Pagination.vue'
import SelectDropdown from '../ui/SelectDropdown.vue'

const props = defineProps<{
  chats: TelegramChat[]
  selectedChats: number[]
  disabled?: boolean
  exportedChats?: Set<number>
}>()

const emit = defineEmits<{
  (e: 'update:selectedChats', value: number[]): void
  (e: 'select', chatId: number): void
}>()

const { t } = useI18n()
const chatTypeOptions = useChatTypeOptions()

const selectedType = ref<string>('user')
const searchQuery = ref('')
const showOnlyExported = ref(true)

const { totalPages, paginatedData, currentPage } = usePagination({
  defaultPage: 1,
  defaultPageSize: 12,
})

const filteredChats = computed(() => {
  let filtered = props.chats

  if (showOnlyExported.value && props.exportedChats) {
    filtered = filtered.filter(chat => props.exportedChats?.has(chat.id))
  }

  if (selectedType.value)
    filtered = filtered.filter(chat => chat.type === selectedType.value)

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(chat =>
      chat.title?.toLowerCase().includes(query)
      || chat.id.toString().includes(query),
    )
  }

  return filtered.map(chat => ({
    id: chat.id,
    title: chat.title || `Chat ${chat.id}`,
    subtitle: `ID: ${chat.id}`,
    type: chat.type,
    hasExported: props.exportedChats?.has(chat.id),
  })).sort((a, b) => {
    const aSelected = props.selectedChats.includes(a.id)
    const bSelected = props.selectedChats.includes(b.id)
    if (aSelected && !bSelected)
      return -1
    if (!aSelected && bSelected)
      return 1
    return 0
  })
})

const paginatedChats = computed(() => {
  return paginatedData(filteredChats.value)
})

const totalPagesCount = computed(() => {
  return totalPages.value(filteredChats.value)
})

function isSelected(id: number): boolean {
  return props.selectedChats.includes(id)
}

function toggleSelection(id: number): void {
  if (props.disabled)
    return

  if (showOnlyExported.value && !props.exportedChats?.has(id)) {
    return
  }

  const newSelection = [...props.selectedChats]
  const index = newSelection.indexOf(id)

  if (index === -1)
    newSelection.push(id)
  else
    newSelection.splice(index, 1)

  emit('update:selectedChats', newSelection)
  emit('select', id)
}

// Reset page when filters change
watch([selectedType, searchQuery, showOnlyExported], () => {
  currentPage.value = 1
})
</script>

<template>
  <div class="space-y-4">
    <!-- Filters -->
    <div class="flex flex-col items-start gap-4 md:flex-row md:items-end">
      <!-- Type Selection -->
      <div class="w-full md:w-48">
        <SelectDropdown
          v-model="selectedType"
          :options="chatTypeOptions"
          :label="t('component.grid_selector.type')"
          :disabled="disabled"
        />
      </div>

      <!-- Search Input -->
      <div class="flex-1">
        <input
          v-model="searchQuery"
          type="text"
          class="w-full rounded-md border border-gray-300 px-4 py-2 dark:border-gray-600 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          :placeholder="t('component.export_command.placeholder_search')"
          :disabled="disabled"
        >
      </div>

      <!-- Show Only Exported Toggle -->
      <div class="flex items-center gap-2">
        <input
          id="show-exported"
          v-model="showOnlyExported"
          type="checkbox"
          class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
          :disabled="disabled"
        >
        <label
          for="show-exported"
          class="text-sm text-gray-600 dark:text-gray-300"
        >{{ t('component.embed_command.show_only_exported') }}</label>
      </div>
    </div>

    <!-- Grid List -->
    <div class="grid gap-4 lg:grid-cols-3 md:grid-cols-2">
      <button
        v-for="chat in paginatedChats"
        :key="chat.id"
        class="relative flex w-full cursor-pointer items-center space-x-3 rounded-lg border p-4 text-left transition-all duration-300 active:scale-98 hover:shadow-md hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
        :class="{
          'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md scale-102': isSelected(chat.id),
          'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600': !isSelected(chat.id),
          'opacity-50 cursor-not-allowed': !chat.hasExported && showOnlyExported,
        }"
        :disabled="disabled || (!chat.hasExported && showOnlyExported)"
        @click="toggleSelection(chat.id)"
      >
        <div class="min-w-0 flex-1">
          <div class="focus:outline-none">
            <p class="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
              {{ chat.title }}
              <span v-if="isSelected(chat.id)" class="text-blue-500 dark:text-blue-400">
                <div class="i-lucide-circle-check h-4 w-4" />
              </span>
              <span
                v-if="chat.hasExported"
                class="ml-1 text-xs text-green-500 dark:text-green-400"
              >
                <div class="i-lucide-database h-4 w-4" />
              </span>
            </p>
            <p class="truncate text-sm text-gray-500 dark:text-gray-400">
              {{ chat.subtitle }}
            </p>
          </div>
        </div>
      </button>
    </div>

    <!-- Pagination -->
    <Pagination
      v-if="totalPagesCount > 1"
      v-model="currentPage"
      :total="totalPagesCount"
      theme="blue"
      :disabled="disabled"
    />

    <!-- No Results Message -->
    <div v-if="filteredChats.length === 0" class="py-8 text-center text-gray-500 dark:text-gray-400">
      {{ showOnlyExported ? t('component.embed_command.no_exported_chats') : t('pages.index.not_chats_found') }}
    </div>
  </div>
</template>
