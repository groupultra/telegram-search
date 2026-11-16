<script setup lang="ts">
import type { CoreChatFolder, CoreDialog } from '@tg-search/core/types'

import { VList } from 'virtua/vue'
import { computed, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'

import EntityAvatar from './avatar/EntityAvatar.vue'

import { Checkbox } from './ui/Checkbox'
import { Empty } from './ui/Empty'
import { Input } from './ui/Input'
import { ListItem } from './ui/ListItem'
import { Segmented } from './ui/Segmented'

const props = defineProps<{
  chats: CoreDialog[]
  folders?: CoreChatFolder[]
}>()

const { t, locale } = useI18n()

const selectedChats = defineModel<number[]>('selectedChats', {
  required: true,
})

const visibleChatIds = defineModel<number[]>('visibleChatIds', {
  default: () => [],
})

// Currently focused chat for status/visualization panel
const activeChatId = defineModel<number | null>('activeChatId', {
  default: null,
})

// Build filter options based on folders
const filterOptions = computed(() => {
  void locale.value // Depend on locale
  const options = [
    { label: t('chatGroups.all'), value: 'all' },
  ]

  if (props.folders) {
    for (const folder of props.folders) {
      options.push({
        label: folder.title,
        value: `folder:${folder.id}`,
      })
    }
  }

  return options
})

const selectedFilter = ref<string>('all')
const searchQuery = ref('')

/**
 * Performance optimization: Use Set for O(1) lookup instead of O(N) array.includes()
 * This significantly improves performance when dealing with large numbers of chats
 */
const selectedChatsSet = computed(() => new Set(selectedChats.value))

const filteredChats = computed(() => {
  let filtered = props.chats

  if (selectedFilter.value !== 'all') {
    if (selectedFilter.value.startsWith('folder:')) {
      const folderId = Number(selectedFilter.value.split(':')[1])
      const folder = props.folders?.find(f => f.id === folderId)
      if (folder) {
        filtered = filtered.filter(chat => chat.folderIds?.includes(folderId))
      }
    }
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(chat =>
      chat.name?.toLowerCase().includes(query)
      || chat.id.toString().includes(query),
    )
  }

  return filtered.map(chat => ({
    id: chat.id,
    title: chat.name || t('chatSelector.chat', { id: chat.id }),
    subtitle: t('chatSelector.id', { id: chat.id }),
    type: chat.type,
    avatarFileId: chat.avatarFileId,
    name: chat.name,
  })).sort((a, b) => {
    // Use optimized Set lookup for better performance
    const aSelected = selectedChatsSet.value.has(a.id)
    const bSelected = selectedChatsSet.value.has(b.id)
    if (aSelected && !bSelected)
      return -1
    if (!aSelected && bSelected)
      return 1
    return 0
  })
})

watchEffect(() => {
  visibleChatIds.value = filteredChats.value.map(chat => chat.id)
})

/**
 * Check if a chat is selected using optimized Set lookup
 * Time complexity: O(1) instead of O(N) with array.includes()
 */
function isSelected(id: number): boolean {
  return selectedChatsSet.value.has(id)
}

function toggleSelection(id: number): void {
  const newSelection = [...selectedChats.value]
  const index = newSelection.indexOf(id)

  if (index === -1)
    newSelection.push(id)
  else
    newSelection.splice(index, 1)

  selectedChats.value = newSelection

  // Always focus the chat that was interacted with so status panel switches accordingly
  activeChatId.value = id
}

function handleChatRowKeydown(event: KeyboardEvent, id: number) {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return
  }

  event.preventDefault()
  toggleSelection(id)
}
</script>

<template>
  <div class="h-full flex flex-col gap-3 lg:flex-row lg:gap-4">
    <!-- Left Sidebar: Filter Groups (Desktop) -->
    <div class="w-40 flex-shrink-0 flex-col gap-0.5 hidden lg:flex">
      <div class="px-3 pb-1.5 pt-2 eyebrow">
        {{ t('chatSelector.filters') }}
      </div>
      <ListItem
        v-for="option in filterOptions"
        :key="option.value"
        :active="selectedFilter === option.value"
        @click="selectedFilter = option.value"
      >
        {{ option.label }}
      </ListItem>
    </div>

    <!-- Mobile Filters (Top Bar) -->
    <div class="no-scrollbar shrink-0 overflow-x-auto lg:hidden">
      <Segmented v-model="selectedFilter" :options="filterOptions" size="sm" />
    </div>

    <!-- Right Content: Search & List -->
    <div class="min-w-0 flex flex-1 flex-col gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <!-- Search Input -->
        <Input
          v-model="searchQuery"
          type="text"
          prefix-icon="i-lucide-search"
          :placeholder="t('chatSelector.searchPlaceholder')"
          class="min-w-48 flex-1"
        />

        <!-- Actions Area -->
        <div class="flex shrink-0 items-center gap-2">
          <slot name="actions" />
        </div>
      </div>

      <!-- Chat List Container -->
      <div class="min-h-0 flex-1 overflow-hidden rounded-lg bg-container shadow-[inset_0_0_0_1px_hsl(var(--line-secondary))] dark:bg-fill-4">
        <!-- No Results Message -->
        <Empty v-if="filteredChats.length === 0" icon="i-lucide-search-x" :title="t('chatSelector.noChatsFound')" />

        <!-- Virtual Chat List -->
        <VList
          v-else
          :data="filteredChats"
          class="h-full p-1"
        >
          <template #default="{ item: chat }">
            <ListItem
              :key="`${chat.id}-${isSelected(chat.id) ? 'checked' : 'unchecked'}`"
              as="div"
              role="button"
              tabindex="0"
              :description="chat.subtitle"
              :active="isSelected(chat.id)"
              class="mb-0.5 font-normal!"
              @click="toggleSelection(chat.id)"
              @keydown="handleChatRowKeydown($event, chat.id)"
            >
              <template #prefix>
                <EntityAvatar
                  :id="chat.id"
                  entity="other"
                  entity-type="chat"
                  :file-id="chat.avatarFileId"
                  :name="chat.name"
                  size="sm"
                  class="shrink-0"
                />
              </template>
              <span class="text-fg">{{ chat.title }}</span>
              <template #suffix>
                <!-- Display only: the whole row toggles the selection. -->
                <Checkbox :model-value="isSelected(chat.id)" tabindex="-1" class="pointer-events-none" />
              </template>
            </ListItem>
          </template>
        </VList>
      </div>
    </div>
  </div>
</template>
