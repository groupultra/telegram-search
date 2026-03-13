<script setup lang="ts">
import type { CoreChatFolder, CoreDialog } from '@tg-search/core/types'

import { VList } from 'virtua/vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import EntityAvatar from './avatar/EntityAvatar.vue'

import { Input } from './ui/Input'

const props = defineProps<{
  chats: CoreDialog[]
  folders?: CoreChatFolder[]
}>()

const { t, locale } = useI18n()

const selectedChats = defineModel<number[]>('selectedChats', {
  required: true,
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
  <div class="h-full flex flex-col gap-4 md:flex-row md:gap-6">
    <!-- Left Sidebar: Filter Groups (Desktop) -->
    <div class="w-32 flex-shrink-0 flex-col gap-1 border-r pr-4 hidden lg:flex">
      <div class="mb-2 px-2 text-xs text-muted-foreground font-semibold tracking-wider uppercase">
        {{ t('chatSelector.filters') }}
      </div>
      <button
        v-for="option in filterOptions"
        :key="option.value"
        class="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition-all"
        :class="selectedFilter === option.value ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'"
        @click="selectedFilter = option.value"
      >
        <span class="truncate">{{ option.label }}</span>
        <span v-if="selectedFilter === option.value" class="i-lucide-chevron-right h-4 w-4 opacity-50" />
      </button>
    </div>

    <!-- Mobile Filters (Top Bar) -->
    <div class="no-scrollbar flex items-center gap-2 overflow-x-auto pb-2 md:hidden">
      <button
        v-for="option in filterOptions"
        :key="option.value"
        class="flex shrink-0 items-center gap-2 border rounded-full px-3 py-1.5 text-xs font-medium transition-all"
        :class="selectedFilter === option.value
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground'"
        @click="selectedFilter = option.value"
      >
        <span>{{ option.label }}</span>
      </button>
    </div>

    <!-- Right Content: Search & List -->
    <div class="min-w-0 flex flex-1 flex-col space-y-4">
      <!-- Search Input -->
      <div class="flex flex-col gap-3">
        <div class="group relative w-full">
          <div
            class="i-lucide-search absolute left-3 top-1/2 h-4 w-4 text-muted-foreground transition-colors -translate-y-1/2 group-focus-within:text-primary"
          />
          <Input
            v-model="searchQuery"
            type="text"
            :placeholder="t('chatSelector.searchPlaceholder')"
            class="h-10 border-border/60 rounded-xl bg-background/80 pl-9 text-foreground shadow-sm transition-all focus:border-primary/35 hover:border-border focus:bg-background hover:bg-background placeholder:text-foreground/45 focus:ring-2 focus:ring-primary/15"
          />
        </div>

        <!-- Actions Area (Below Search) -->
        <div class="flex items-center justify-between">
          <slot name="actions" />
        </div>
      </div>

      <!-- Chat List Container -->
      <div class="min-h-0 flex-1 overflow-hidden border rounded-lg bg-card">
        <!-- No Results Message -->
        <div v-if="filteredChats.length === 0" class="h-full flex flex-col items-center justify-center py-16">
          <div class="mb-4 h-16 w-16 flex items-center justify-center rounded-full bg-muted">
            <span class="i-lucide-search-x h-8 w-8 text-muted-foreground" />
          </div>
          <p class="text-base text-muted-foreground font-medium">
            {{ t('chatSelector.noChatsFound') }}
          </p>
        </div>

        <!-- Virtual Chat List -->
        <VList
          v-else
          :data="filteredChats"
          class="h-full"
        >
          <template #default="{ item: chat }">
            <div
              :key="`${chat.id}-${isSelected(chat.id) ? 'checked' : 'unchecked'}`"
              class="group flex cursor-pointer items-center gap-3 border-b px-4 py-3 transition-all hover:bg-accent/50"
              :class="{
                'bg-primary/5': isSelected(chat.id),
              }"
              role="button"
              tabindex="0"
              @click="toggleSelection(chat.id)"
              @keydown="handleChatRowKeydown($event, chat.id)"
            >
              <EntityAvatar
                :id="chat.id"
                entity="other"
                entity-type="chat"
                :file-id="chat.avatarFileId"
                :name="chat.name"
                size="sm"
                class="shrink-0"
              />

              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-2">
                  <p class="truncate text-sm text-foreground font-medium">
                    {{ chat.title }}
                  </p>
                </div>
                <p class="truncate text-xs text-muted-foreground">
                  {{ chat.subtitle }}
                </p>
              </div>

              <div
                class="h-5 w-5 flex shrink-0 items-center justify-center border rounded-md transition-colors"
                :class="isSelected(chat.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-border/70 text-transparent'"
              >
                <span class="i-lucide-check h-3 w-3" />
              </div>
            </div>
          </template>
        </VList>
      </div>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
