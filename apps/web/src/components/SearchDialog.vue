<script setup lang="ts">
import type { DialogType } from '@tg-search/core/types'

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/DropdownMenu'
import { Input } from './ui/Input'

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
      const el = inputRef.value?.$el as HTMLElement | undefined
      el?.focus()
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
        class="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]"
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
        class="h-full min-h-0 flex flex-col overflow-hidden bg-popover text-popover-foreground shadow-2xl outline-none"
        :class="isMobile
          ? 'border-t rounded-t-2xl'
          : 'border rounded-xl'"
      >
        <!-- Mobile drawer handle -->
        <div v-if="isMobile" class="mx-auto mt-2 h-1 w-10 rounded-full bg-border" />

        <!-- Search input header -->
        <div class="border-b" :class="isMobile ? 'px-2 py-1' : 'px-2 py-1'">
          <div class="flex flex-col gap-2" :class="!isMobile && 'md:flex-row md:items-center md:gap-3'">
            <div class="min-w-0 flex items-center" :class="!isMobile && 'gap-3 md:flex-1'">
              <div class="relative min-w-0 flex flex-1 items-center">
                <div class="pointer-events-none absolute left-2.5 z-10 flex items-center justify-center">
                  <span class="i-lucide-search h-4.5 w-4.5 text-muted-foreground" />
                </div>
                <Input
                  ref="inputRef"
                  v-model="keyword"
                  class="h-12 w-full border-transparent bg-transparent pl-10 pr-3 text-base shadow-none focus-visible:border-transparent hover:border-transparent focus-visible:ring-0"
                  :placeholder="t('searchDialog.searchMessages')"
                />
              </div>
            </div>

            <div
              v-if="hasCurrentChatScope"
              :class="isMobile && 'flex items-center justify-end'"
            >
              <div
                class="no-scrollbar inline-flex shrink-0 items-center gap-0.5 overflow-x-auto border rounded-lg bg-muted/60 p-0.5"
                :class="isMobile ? 'mb-2 mr-2' : 'mr-2'"
              >
                <button
                  class="inline-flex items-center gap-1 whitespace-nowrap transition-colors"
                  :class="[
                    searchScope === 'current'
                      ? 'bg-background text-foreground font-medium shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                    'h-7 rounded-md px-2 text-xs',
                  ]"
                  @click="searchScope = 'current'"
                >
                  <span class="i-lucide-message-circle h-3.5 w-3.5" />
                  <span>{{ t('searchDialog.scopeCurrent') }}</span>
                </button>
                <button
                  class="inline-flex items-center gap-1 whitespace-nowrap transition-colors"
                  :class="[
                    searchScope === 'all'
                      ? 'bg-background text-foreground font-medium shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                    'h-7 rounded-md px-2 text-xs',
                  ]"
                  @click="searchScope = 'all'"
                >
                  <span class="i-lucide-globe h-3.5 w-3.5" />
                  <span>{{ t('searchDialog.scopeAll') }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Mode tabs -->
        <div class="border-b">
          <div class="flex items-center justify-between gap-3 px-3 py-2">
            <div class="no-scrollbar min-w-0 flex items-center gap-1 overflow-x-auto">
              <button
                v-for="mode in activeModeMeta"
                :key="mode.key"
                class="h-7 inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs transition-colors"
                :class="activeMode === mode.key
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'"
                @click="activeMode = mode.key"
              >
                <span :class="mode.icon" class="h-3.5 w-3.5" />
                <span>{{ mode.label }}</span>
              </button>
            </div>

            <DropdownMenu v-if="activeMode !== 'commands'">
              <DropdownMenuTrigger as-child>
                <button
                  class="h-7 inline-flex shrink-0 items-center gap-1.5 border rounded-md px-2.5 text-xs transition-colors"
                  :class="hasCustomChatTypeFilter
                    ? 'border-primary text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'"
                >
                  <span class="i-lucide-filter h-3.5 w-3.5" />
                  <span>{{ activeChatTypeFilterMeta?.label }}</span>
                  <span class="i-lucide-chevron-down h-3.5 w-3.5 opacity-70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" class="min-w-[200px]">
                <DropdownMenuLabel class="px-2 py-1.5 eyebrow">
                  {{ t('searchDialog.filters') }}
                </DropdownMenuLabel>
                <DropdownMenuSeparator class="my-1" />
                <DropdownMenuItem
                  v-for="chatType in chatTypeFilterMeta"
                  :key="chatType.key"
                  class="flex items-center justify-between"
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
                <p class="px-2 py-2 eyebrow">
                  {{ t('searchDialog.quickActions') }}
                </p>
                <div v-if="filteredCommandItems.length > 0" class="space-y-0.5">
                  <button
                    v-for="item in filteredCommandItems"
                    :key="item.id"
                    class="w-full flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent"
                    @click="item.action()"
                  >
                    <span class="h-8 w-8 flex shrink-0 items-center justify-center border rounded-md"><span :class="item.icon" class="h-4 w-4" /></span>
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-medium">
                        {{ item.title }}
                      </p>
                      <p class="truncate text-xs text-muted-foreground">
                        {{ item.description }}
                      </p>
                    </div>
                  </button>
                </div>
                <div v-else class="py-10 text-center text-sm text-muted-foreground">
                  {{ t('searchDialog.noCommands') }}
                </div>
              </div>
            </div>
            <div v-else-if="shouldRunSearch" class="h-full">
              <template v-if="isLoading">
                <div class="h-full flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <div class="relative mb-4">
                    <span class="i-lucide-loader-circle animate-spin text-2xl text-muted-foreground" />
                  </div>
                  <span class="text-sm">{{ t('searchDialog.searching') }}</span>
                </div>
              </template>
              <template v-else-if="hasFilteredResults">
                <div v-if="showMessagesPanel && filteredMessages.length > 0" class="h-full">
                  <div
                    v-if="activeMode === 'all'"
                    class="sticky top-0 z-10 border-b bg-popover px-4 py-2 eyebrow"
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
                    class="sticky top-0 z-10 border-b bg-popover px-4 py-2 eyebrow"
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
                <div class="h-full flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <div class="relative mb-4">
                    <span class="i-lucide-loader-circle animate-spin text-2xl text-muted-foreground" />
                  </div>
                  <span class="text-sm">{{ t('searchDialog.searching') }}</span>
                </div>
              </template>
              <template v-else-if="hasResults && hasCustomChatTypeFilter">
                <div class="h-full flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <div class="relative mb-4">
                    <span class="i-lucide-filter-x text-3xl text-muted-foreground/50" />
                  </div>
                  <span class="text-sm">{{ t('searchDialog.noFilteredResults') }}</span>
                </div>
              </template>
              <template v-else>
                <div class="h-full flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <div class="relative mb-4">
                    <span class="i-lucide-search-x text-3xl text-muted-foreground/50" />
                  </div>
                  <span class="text-sm">{{ t('searchDialog.noResults') }}</span>
                </div>
              </template>
            </div>
            <div v-else class="h-full flex flex-col items-center justify-center text-muted-foreground">
              <div class="relative mb-4">
                <span class="i-lucide-search text-3xl text-muted-foreground/40" />
              </div>
              <p class="text-sm text-foreground font-medium">
                {{ t('searchDialog.startTyping') }}
              </p>
              <p class="mt-1 text-xs text-muted-foreground">
                {{ t('searchDialog.searchDescription') }}
              </p>
              <div class="mt-6 max-w-sm w-full px-4 space-y-0.5">
                <button
                  v-for="item in commandItems.slice(0, 3)"
                  :key="item.id"
                  class="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent"
                  @click="item.action()"
                >
                  <span :class="item.icon" class="h-4 w-4 text-muted-foreground" />
                  <span>{{ item.title }}</span>
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </Teleport>
</template>
