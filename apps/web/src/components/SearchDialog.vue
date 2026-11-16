<script setup lang="ts">
import type { DialogType } from '@tg-search/core/types'

import type { SearchScope } from '../utils/search-dialog'
import type { SegmentedOption } from './ui/Segmented'

import { useChatStore } from '@tg-search/client'
import { onKeyStroke, useDebounce, useMediaQuery } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import MessageList from './messages/MessageList.vue'
import PhotoSearchResults from './PhotoSearchResults.vue'

import { useSearchDialogResults } from '../composables/use-search-dialog-results'
import { useSearchDialogState } from '../composables/use-search-dialog-state'
import {
  createSearchChatTypeFilters,
  createSearchDialogCommands,
  createSearchModes,
  filterSearchDialogCommands,
  matchesSearchChatTypeFilter,
} from '../utils/search-dialog'
import { Button } from './ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from './ui/DropdownMenu'
import { Empty } from './ui/Empty'
import { Input } from './ui/Input'
import { ListItem } from './ui/ListItem'
import { Segmented } from './ui/Segmented'
import { Spinner } from './ui/Spinner'

const props = defineProps<{
  chatId?: string
}>()

const { t } = useI18n()
const router = useRouter()
const isMobile = useMediaQuery('(max-width: 768px)')
const chatStore = useChatStore()

const isOpen = defineModel<boolean>('open', { required: true })
const inputRef = ref<InstanceType<typeof Input> | null>(null)

const cacheKey = computed(() => props.chatId ? `chat:${props.chatId}` : 'global')
const hasCurrentChatScope = computed(() => !!props.chatId)

const {
  activeMode,
  chatTypeFilter,
  keyword,
  searchScope,
} = useSearchDialogState(cacheKey, hasCurrentChatScope)
const keywordDebounced = useDebounce(keyword, 1000)

const OPEN_AI_CHAT_EVENT = 'tg-search:open-ai-chat'

const activeModeMeta = computed(() => createSearchModes(t))
const modeOptions = computed(() => activeModeMeta.value.map(mode => ({ value: mode.key, label: mode.label, icon: mode.icon })))
const scopeOptions = computed<SegmentedOption<SearchScope>[]>(() => [
  { value: 'current', label: t('searchDialog.scopeCurrent'), icon: 'i-lucide-message-circle' },
  { value: 'all', label: t('searchDialog.scopeAll'), icon: 'i-lucide-globe' },
])
const chatTypeFilterMeta = computed(() => createSearchChatTypeFilters(t))
const activeChatTypeFilterMeta = computed(() => {
  return chatTypeFilterMeta.value.find(item => item.key === chatTypeFilter.value)
    ?? chatTypeFilterMeta.value[0]
})
const hasCustomChatTypeFilter = computed(() => chatTypeFilter.value !== 'all')

const scopedCommandChatIds = computed(() => {
  return (searchScope.value === 'current' && props.chatId)
    ? [Number.parseInt(props.chatId, 10)]
    : []
})

const commandItems = computed(() => {
  return createSearchDialogCommands({
    t,
    scopedChatIds: scopedCommandChatIds.value,
    onClose: () => {
      isOpen.value = false
    },
    onOpenAIChat: (chatIds) => {
      window.dispatchEvent(new CustomEvent(OPEN_AI_CHAT_EVENT, {
        detail: { chatIds },
      }))
    },
    onOpenChats: () => {
      void router.push('/chats')
    },
    onOpenSettings: () => {
      void router.push('/settings')
    },
    onOpenSync: () => {
      void router.push('/sync')
    },
  })
})

const filteredCommandItems = computed(() => {
  return filterSearchDialogCommands(commandItems.value, keywordDebounced.value)
})

function resolveMessageDialogType(message: { inChatType?: DialogType, chatId: string }): DialogType | undefined {
  return message.inChatType ?? chatStore.getChat(message.chatId)?.type
}

function resolvePhotoDialogType(photo: { chatId?: string, chatType?: DialogType }): DialogType | undefined {
  if (photo.chatType) {
    return photo.chatType
  }

  if (!photo.chatId) {
    return undefined
  }

  return chatStore.getChat(photo.chatId)?.type
}

function selectChatTypeFilter(nextFilter: typeof chatTypeFilter.value) {
  chatTypeFilter.value = nextFilter
}

const scopedChatId = computed(() => {
  if (searchScope.value !== 'current') {
    return undefined
  }
  return props.chatId
})

const {
  hasResults,
  isLoading,
  isLoadingMoreMessages,
  isLoadingMorePhotos,
  loadMoreMessages,
  loadMorePhotos,
  messagesHasMore,
  photoResult,
  photosHasMore,
  searchResult,
  shouldRunSearch,
  showMessagesPanel,
  showPhotosPanel,
} = useSearchDialogResults({
  activeMode,
  keyword,
  keywordDebounced,
  scopedChatId,
})

const filteredMessages = computed(() => {
  return searchResult.value.filter(message =>
    matchesSearchChatTypeFilter(chatTypeFilter.value, resolveMessageDialogType(message)),
  )
})

const filteredPhotos = computed(() => {
  return photoResult.value.filter(photo =>
    matchesSearchChatTypeFilter(chatTypeFilter.value, resolvePhotoDialogType(photo)),
  )
})

const hasFilteredResults = computed(() => {
  return filteredMessages.value.length > 0 || filteredPhotos.value.length > 0
})

// True while the auto-load watcher is fetching more message pages to satisfy
// the current filter — used to show a spinner instead of a premature empty state.
const isAutoLoadingForFilter = computed(() => {
  if (!hasCustomChatTypeFilter.value || hasFilteredResults.value) {
    return false
  }

  return isLoadingMoreMessages.value && messagesHasMore.value
})

// When the client-side filter hides all loaded messages but the server has more
// data, automatically fetch the next page so the user doesn't see a false
// "no results" state.
// NOTICE: only messages support offset-based pagination; photo search always
// returns the same top-N results regardless of offset, so auto-loading photos
// would cause an infinite request loop.
watch([filteredMessages, messagesHasMore, isLoadingMoreMessages], () => {
  if (isLoading.value || !hasCustomChatTypeFilter.value) {
    return
  }

  if (showMessagesPanel.value && filteredMessages.value.length === 0 && messagesHasMore.value && !isLoadingMoreMessages.value) {
    loadMoreMessages().catch(() => {})
  }
})

onKeyStroke('Escape', () => {
  if (isOpen.value) {
    isOpen.value = false
  }
})

// Focus the search input when the dialog opens
watch(isOpen, (open) => {
  if (open) {
    requestAnimationFrame(() => {
      inputRef.value?.focus()
    })
  }
})
</script>

<template>
  <Teleport to="body">
    <!-- Overlay -->
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-show="isOpen"
        class="fixed inset-0 z-50 bg-mask"
        @click="isOpen = false"
      />
    </Transition>

    <!-- Content panel — always mounted, hidden with v-show to preserve scroll position -->
    <div
      v-show="isOpen"
      class="fixed z-50"
      :class="isMobile
        ? 'bottom-0 left-0 right-0 h-[86vh] max-h-[86vh]'
        : 'left-1/2 top-[10vh] h-[76vh] max-w-2xl w-[calc(100%-2rem)] -translate-x-1/2'"
      role="dialog"
      aria-modal="true"
    >
      <div
        class="h-full min-h-0 flex flex-col overflow-hidden bg-elevated text-fg shadow-modal outline-none"
        :class="isMobile ? 'rounded-t-lg' : 'rounded-lg'"
      >
        <!-- Mobile drawer handle -->
        <div v-if="isMobile" class="mx-auto mt-2 h-1 w-9 rounded-full bg-fill" />

        <!-- Search input header -->
        <div class="flex items-center gap-2 border-b border-line-2 p-2">
          <Input
            ref="inputRef"
            v-model="keyword"
            size="lg"
            variant="borderless"
            prefix-icon="i-lucide-search"
            class="min-w-0 flex-1 text-base"
            :placeholder="t('searchDialog.searchMessages')"
          />
          <Segmented
            v-if="hasCurrentChatScope"
            v-model="searchScope"
            :options="scopeOptions"
            size="sm"
            class="shrink-0"
          />
        </div>

        <!-- Mode tabs -->
        <div class="flex items-center justify-between gap-3 border-b border-line-2 px-2 py-2">
          <div class="no-scrollbar min-w-0 overflow-x-auto">
            <Segmented v-model="activeMode" :options="modeOptions" size="sm" />
          </div>

          <DropdownMenu v-if="activeMode !== 'commands'">
            <DropdownMenuTrigger as-child>
              <Button size="sm" icon="i-lucide-filter" class="shrink-0" :class="hasCustomChatTypeFilter ? 'border-primary' : ''">
                {{ activeChatTypeFilterMeta?.label }}
                <span class="i-lucide-chevron-down h-3.5 w-3.5 text-fg-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                {{ t('searchDialog.filters') }}
              </DropdownMenuLabel>
              <DropdownMenuItem
                v-for="chatType in chatTypeFilterMeta"
                :key="chatType.key"
                class="justify-between"
                @select="selectChatTypeFilter(chatType.key)"
              >
                <span>{{ chatType.label }}</span>
                <span
                  v-if="chatTypeFilter === chatType.key"
                  class="i-lucide-check h-4 w-4"
                />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <!-- Results area -->
        <div class="min-h-0 flex-1 overflow-y-auto">
          <Transition
            enter-active-class="transition-all duration-300 ease-out"
            enter-from-class="opacity-0 translate-y-2"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition-all duration-200 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 translate-y-2"
            mode="out-in"
          >
            <div v-if="activeMode === 'commands'" class="h-full">
              <div class="p-2">
                <p class="px-3 pb-1.5 pt-2 eyebrow">
                  {{ t('searchDialog.quickActions') }}
                </p>
                <div v-if="filteredCommandItems.length > 0" class="flex flex-col gap-0.5">
                  <ListItem
                    v-for="item in filteredCommandItems"
                    :key="item.id"
                    :icon="item.icon"
                    :description="item.description"
                    @click="item.action()"
                  >
                    <span class="text-fg">{{ item.title }}</span>
                  </ListItem>
                </div>
                <Empty v-else :title="t('searchDialog.noCommands')" />
              </div>
            </div>
            <div v-else-if="shouldRunSearch" class="h-full">
              <template v-if="isLoading">
                <div class="h-full flex items-center justify-center gap-2 py-16 text-sm text-fg-3">
                  <Spinner />
                  <span>{{ t('searchDialog.searching') }}</span>
                </div>
              </template>
              <template v-else-if="hasFilteredResults">
                <div v-if="showMessagesPanel && filteredMessages.length > 0" class="h-full">
                  <div
                    v-if="activeMode === 'all'"
                    class="sticky top-0 z-10 border-b bg-elevated px-4 py-2 eyebrow"
                  >
                    {{ t('searchDialog.messages') }} ({{ filteredMessages.length }}{{ messagesHasMore ? '+' : '' }})
                  </div>
                  <MessageList
                    :messages="filteredMessages"
                    :keyword="keyword"
                    :has-more="messagesHasMore"
                    :is-loading-more="isLoadingMoreMessages"
                    @load-more="loadMoreMessages"
                    @navigate="isOpen = false"
                  />
                </div>

                <div v-if="showPhotosPanel && filteredPhotos.length > 0" class="h-full">
                  <div
                    v-if="activeMode === 'all'"
                    class="sticky top-0 z-10 border-b bg-elevated px-4 py-2 eyebrow"
                  >
                    {{ t('searchDialog.photos') }} ({{ filteredPhotos.length }}{{ photosHasMore ? '+' : '' }})
                  </div>
                  <PhotoSearchResults
                    :photos="filteredPhotos"
                    :has-more="photosHasMore"
                    :is-loading-more="isLoadingMorePhotos"
                    @load-more="loadMorePhotos"
                    @navigate="isOpen = false"
                  />
                </div>
              </template>
              <template v-else-if="isAutoLoadingForFilter">
                <div class="h-full flex items-center justify-center gap-2 py-16 text-sm text-fg-3">
                  <Spinner />
                  <span>{{ t('searchDialog.searching') }}</span>
                </div>
              </template>
              <template v-else-if="hasResults && hasCustomChatTypeFilter">
                <Empty icon="i-lucide-filter-x" :title="t('searchDialog.noFilteredResults')" />
              </template>
              <template v-else>
                <Empty icon="i-lucide-search-x" :title="t('searchDialog.noResults')" />
              </template>
            </div>
            <div v-else class="h-full flex flex-col items-center justify-center">
              <Empty icon="i-lucide-search" :title="t('searchDialog.startTyping')" :description="t('searchDialog.searchDescription')" class="h-auto" />
              <div class="max-w-xs w-full flex flex-col gap-0.5 px-4">
                <ListItem
                  v-for="item in commandItems.slice(0, 3)"
                  :key="item.id"
                  :icon="item.icon"
                  @click="item.action()"
                >
                  {{ item.title }}
                </ListItem>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </Teleport>
</template>
