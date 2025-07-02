<script setup lang="ts">
import type { CoreDialog } from '@tg-search/core/types'

import { usePagination } from '@tg-search/client'
import { computed, ref, watch } from 'vue'

import Pagination from './ui/Pagination.vue'
import SelectDropdown from './ui/SelectDropdown.vue'

const props = defineProps<{
  chats: CoreDialog[]
}>()

const selectedChats = defineModel<number[]>('selectedChats', {
  required: true,
})

const chatTypeOptions = ref([
  { label: 'User', value: 'user' },
  { label: 'Group', value: 'group' },
  { label: 'Channel', value: 'channel' },
])

const selectedType = ref<string>('user')
const searchQuery = ref('')

const { totalPages, paginatedData, currentPage } = usePagination({
  defaultPage: 1,
  defaultPageSize: 12,
})

const filteredChats = computed(() => {
  let filtered = props.chats

  if (selectedType.value)
    filtered = filtered.filter(chat => chat.type === selectedType.value)

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(chat =>
      chat.name?.toLowerCase().includes(query)
      || chat.id.toString().includes(query),
    )
  }

  return filtered.map(chat => ({
    id: chat.id,
    title: chat.name || `Chat ${chat.id}`,
    subtitle: `ID: ${chat.id}`,
    type: chat.type,
  })).sort((a, b) => {
    const aSelected = selectedChats.value.includes(a.id)
    const bSelected = selectedChats.value.includes(b.id)
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
  return selectedChats.value.includes(id)
}

function toggleSelection(id: number): void {
  const newSelection = [...selectedChats.value]
  const index = newSelection.indexOf(id)

  if (index === -1)
    newSelection.push(id)
  else
    newSelection.splice(index, 1)

  selectedChats.value = newSelection
}

// Reset page when filters change
watch([selectedType, searchQuery], () => {
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
          label="Type"
        />
      </div>

      <!-- Search Input -->
      <div class="flex-1">
        <input
          v-model="searchQuery"
          type="text"
          class="w-full border border-neutral-200 rounded-md bg-neutral-100 px-4 py-2 focus:border-primary focus:ring-2 focus:ring-primary"
          placeholder="Search"
        >
      </div>
    </div>

    <!-- Grid List -->
    <div v-auto-animate class="grid gap-4 lg:grid-cols-3 md:grid-cols-2">
      <button
        v-for="chat in paginatedChats"
        :key="chat.id"
        class="relative w-full flex cursor-pointer items-center border rounded-lg p-4 text-left transition-all duration-300 active:scale-98 space-x-3 hover:shadow-md hover:-translate-y-0.5"
        :class="{
          'border-primary border-1 shadow-md scale-102': isSelected(chat.id),
          'border-neutral-200 hover:border-primary': !isSelected(chat.id),
        }"
        @click="toggleSelection(chat.id)"
      >
        <div class="min-w-0 flex-1">
          <div class="focus:outline-none">
            <p class="flex items-center gap-2 text-sm font-medium">
              {{ chat.title }}
              <span v-if="isSelected(chat.id)" class="text-primary">
                <div class="i-lucide-circle-check h-4 w-4" />
              </span>
            </p>
            <p class="truncate text-sm text-complementary-600">
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
    />

    <!-- No Results Message -->
    <div v-if="filteredChats.length === 0" class="py-8 text-center text-complementary-600">
      No chats found
    </div>
  </div>
</template>
