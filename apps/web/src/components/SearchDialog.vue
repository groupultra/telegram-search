<script setup lang="ts">
import type { SearchMode, SearchScope } from '../utils/search-dialog'

import { useDebounce, useMediaQuery } from '@vueuse/core'
import {
  DrawerRoot as Drawer,
  DrawerContent,
  DrawerOverlay,
  DrawerPortal,
} from 'vaul-vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import MessageList from './messages/MessageList.vue'
import PhotoSearchResults from './PhotoSearchResults.vue'

import { useSearchDialogResults } from '../composables/use-search-dialog-results'
import {
  createSearchDialogCommands,
  createSearchModes,
  filterSearchDialogCommands,
} from '../utils/search-dialog'
import { Dialog, DialogContent, DialogTitle } from './ui/Dialog'
import { Input } from './ui/Input'

const props = defineProps<{
  chatId?: string
}>()

const { t } = useI18n()
const router = useRouter()
const isMobile = useMediaQuery('(max-width: 768px)')

const isOpen = defineModel<boolean>('open', { required: true })

const keyword = ref('')
const keywordDebounced = useDebounce(keyword, 1000)

const activeMode = ref<SearchMode>('all')
const searchScope = ref<SearchScope>('all')
const hasCurrentChatScope = computed(() => !!props.chatId)

const OPEN_AI_CHAT_EVENT = 'tg-search:open-ai-chat'

const activeModeMeta = computed(() => createSearchModes(t))

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
  keywordDebounced,
  scopedChatId,
})

watch(
  () => props.chatId,
  (chatId) => {
    searchScope.value = chatId ? 'current' : 'all'
  },
  { immediate: true },
)
</script>

<template>
  <Drawer v-if="isMobile" v-model:open="isOpen">
    <DrawerPortal>
      <DrawerOverlay class="fixed inset-0 z-50 bg-black/50" />
      <DrawerContent class="fixed bottom-0 left-0 right-0 z-50 h-[86vh] max-h-[86vh] flex flex-col rounded-t-2xl bg-background/95 outline-none">
        <div class="mx-auto mt-2 h-1.5 w-10 rounded-full bg-muted" />

        <div class="border-b bg-background/50 p-4 backdrop-blur-sm">
          <div class="flex flex-col gap-2">
            <div class="relative min-w-0 flex flex-1 items-center">
              <div class="pointer-events-none absolute left-4 z-10 flex items-center justify-center">
                <span class="i-lucide-search h-5 w-5 text-muted-foreground" />
              </div>
              <Input
                v-model="keyword"
                class="h-12 w-full border-input rounded-xl bg-muted/50 pl-12 pr-4 text-base transition-colors focus-visible:bg-background"
                :placeholder="t('searchDialog.searchMessages')"
                autofocus
              />
            </div>

            <div v-if="hasCurrentChatScope" class="flex items-center justify-end">
              <div class="no-scrollbar h-9 inline-flex items-center gap-1 overflow-x-auto border border-border/60 rounded-lg bg-muted/30 p-1">
                <button
                  class="h-7 inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 text-[11px] transition-colors"
                  :class="searchScope === 'current'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'"
                  @click="searchScope = 'current'"
                >
                  <span class="i-lucide-message-circle h-3.5 w-3.5" />
                  <span>{{ t('searchDialog.scopeCurrent') }}</span>
                </button>
                <button
                  class="h-7 inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 text-[11px] transition-colors"
                  :class="searchScope === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'"
                  @click="searchScope = 'all'"
                >
                  <span class="i-lucide-globe h-3.5 w-3.5" />
                  <span>{{ t('searchDialog.scopeAll') }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="no-scrollbar flex items-center gap-1 overflow-x-auto border-b px-3 py-2">
          <button
            v-for="mode in activeModeMeta"
            :key="mode.key"
            class="h-8 inline-flex items-center gap-1.5 rounded-full px-3 text-xs transition-colors"
            :class="activeMode === mode.key
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'"
            @click="activeMode = mode.key"
          >
            <span :class="mode.icon" class="h-3.5 w-3.5" />
            <span>{{ mode.label }}</span>
          </button>
        </div>

        <div class="min-h-[300px] flex-1 overflow-y-auto">
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
              <div class="p-4">
                <p class="mb-3 text-xs text-muted-foreground">
                  {{ t('searchDialog.quickActions') }}
                </p>
                <div v-if="filteredCommandItems.length > 0" class="space-y-2">
                  <button
                    v-for="item in filteredCommandItems"
                    :key="item.id"
                    class="w-full flex items-center gap-3 border border-border/60 rounded-xl bg-card/40 p-3 text-left transition-colors hover:bg-muted/40"
                    @click="item.action()"
                  >
                    <span :class="item.icon" class="h-4 w-4 shrink-0 text-primary" />
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
                    <span class="i-lucide-loader-circle animate-spin text-5xl text-primary" />
                  </div>
                  <span class="text-base font-medium">{{ t('searchDialog.searching') }}</span>
                </div>
              </template>
              <template v-else-if="hasResults">
                <div v-if="showMessagesPanel && searchResult.length > 0" class="h-full">
                  <div
                    v-if="activeMode === 'all'"
                    class="sticky top-0 z-10 border-b bg-background/80 px-4 py-2 text-xs text-muted-foreground backdrop-blur"
                  >
                    {{ t('searchDialog.messages') }} ({{ searchResult.length }}{{ messagesHasMore ? '+' : '' }})
                  </div>
                  <MessageList
                    :messages="searchResult"
                    :keyword="keyword"
                    :has-more="messagesHasMore"
                    :is-loading-more="isLoadingMoreMessages"
                    @load-more="loadMoreMessages"
                    @close="isOpen = false"
                  />
                </div>

                <div v-if="showPhotosPanel && photoResult.length > 0" class="h-full">
                  <div
                    v-if="activeMode === 'all'"
                    class="sticky top-0 z-10 border-b bg-background/80 px-4 py-2 text-xs text-muted-foreground backdrop-blur"
                  >
                    {{ t('searchDialog.photos') }} ({{ photoResult.length }}{{ photosHasMore ? '+' : '' }})
                  </div>
                  <PhotoSearchResults
                    :photos="photoResult"
                    :has-more="photosHasMore"
                    :is-loading-more="isLoadingMorePhotos"
                    @load-more="loadMorePhotos"
                    @close="isOpen = false"
                  />
                </div>
              </template>
              <template v-else>
                <div class="h-full flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <div class="relative mb-4">
                    <span class="i-lucide-search-x text-5xl text-muted" />
                  </div>
                  <span class="text-base font-medium">{{ t('searchDialog.noResults') }}</span>
                </div>
              </template>
            </div>
            <div v-else class="h-full flex flex-col items-center justify-center text-muted-foreground">
              <div class="relative mb-4">
                <span class="i-lucide-search text-5xl text-muted/50" />
              </div>
              <p class="text-base font-medium">
                {{ t('searchDialog.startTyping') }}
              </p>
              <p class="text-sm text-muted-foreground/60">
                {{ t('searchDialog.searchDescription') }}
              </p>
              <div class="mt-6 max-w-md w-full px-4 space-y-2">
                <button
                  v-for="item in commandItems.slice(0, 3)"
                  :key="item.id"
                  class="w-full flex items-center gap-2 border border-border/60 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40"
                  @click="item.action()"
                >
                  <span :class="item.icon" class="h-4 w-4 text-primary" />
                  <span>{{ item.title }}</span>
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </DrawerContent>
    </DrawerPortal>
  </Drawer>

  <Dialog v-else v-model:open="isOpen">
    <DialogContent class="h-full max-w-3xl gap-0 overflow-hidden border-0 rounded-none bg-background/95 p-0 backdrop-blur-xl md:h-auto md:max-h-[85vh] md:border md:rounded-2xl">
      <DialogTitle class="sr-only">
        {{ t('searchDialog.searchMessages') }}
      </DialogTitle>

      <div class="border-b bg-background/50 p-4 backdrop-blur-sm md:p-6">
        <div class="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
          <div class="min-w-0 flex items-center gap-3 md:flex-1">
            <div class="relative min-w-0 flex flex-1 items-center">
              <div class="pointer-events-none absolute left-4 z-10 flex items-center justify-center">
                <span class="i-lucide-search h-5 w-5 text-muted-foreground" />
              </div>
              <Input
                v-model="keyword"
                class="h-12 w-full border-input rounded-xl bg-muted/50 pl-12 pr-4 text-base transition-colors md:h-14 focus-visible:bg-background"
                :placeholder="t('searchDialog.searchMessages')"
                autofocus
              />
            </div>
          </div>

          <div
            v-if="hasCurrentChatScope"
            class="no-scrollbar h-10 flex items-center gap-1 overflow-x-auto border border-border/60 rounded-xl bg-muted/30 p-1 md:h-14 md:shrink-0"
          >
            <button
              class="h-8 inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2 text-xs transition-colors md:h-12 md:rounded-xl md:px-3"
              :class="searchScope === 'current'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'"
              @click="searchScope = 'current'"
            >
              <span class="i-lucide-message-circle h-3.5 w-3.5" />
              <span>{{ t('searchDialog.scopeCurrent') }}</span>
            </button>
            <button
              class="h-8 inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2 text-xs transition-colors md:h-12 md:rounded-xl md:px-3"
              :class="searchScope === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'"
              @click="searchScope = 'all'"
            >
              <span class="i-lucide-globe h-3.5 w-3.5" />
              <span>{{ t('searchDialog.scopeAll') }}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="no-scrollbar flex items-center gap-1 overflow-x-auto border-b px-3 py-2">
        <button
          v-for="mode in activeModeMeta"
          :key="mode.key"
          class="h-8 inline-flex items-center gap-1.5 rounded-full px-3 text-xs transition-colors"
          :class="activeMode === mode.key
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'"
          @click="activeMode = mode.key"
        >
          <span :class="mode.icon" class="h-3.5 w-3.5" />
          <span>{{ mode.label }}</span>
        </button>
      </div>

      <div class="min-h-[300px] flex-1 overflow-y-auto">
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
            <div class="p-4 md:p-6">
              <p class="mb-3 text-xs text-muted-foreground">
                {{ t('searchDialog.quickActions') }}
              </p>
              <div v-if="filteredCommandItems.length > 0" class="space-y-2">
                <button
                  v-for="item in filteredCommandItems"
                  :key="item.id"
                  class="w-full flex items-center gap-3 border border-border/60 rounded-xl bg-card/40 p-3 text-left transition-colors hover:bg-muted/40"
                  @click="item.action()"
                >
                  <span :class="item.icon" class="h-4 w-4 shrink-0 text-primary" />
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
                  <span class="i-lucide-loader-circle animate-spin text-5xl text-primary" />
                </div>
                <span class="text-base font-medium">{{ t('searchDialog.searching') }}</span>
              </div>
            </template>
            <template v-else-if="hasResults">
              <div v-if="showMessagesPanel && searchResult.length > 0" class="h-full">
                <div
                  v-if="activeMode === 'all'"
                  class="sticky top-0 z-10 border-b bg-background/80 px-4 py-2 text-xs text-muted-foreground backdrop-blur md:px-6"
                >
                  {{ t('searchDialog.messages') }} ({{ searchResult.length }}{{ messagesHasMore ? '+' : '' }})
                </div>
                <MessageList
                  :messages="searchResult"
                  :keyword="keyword"
                  :has-more="messagesHasMore"
                  :is-loading-more="isLoadingMoreMessages"
                  @load-more="loadMoreMessages"
                  @close="isOpen = false"
                />
              </div>

              <div v-if="showPhotosPanel && photoResult.length > 0" class="h-full">
                <div
                  v-if="activeMode === 'all'"
                  class="sticky top-0 z-10 border-b bg-background/80 px-4 py-2 text-xs text-muted-foreground backdrop-blur md:px-6"
                >
                  {{ t('searchDialog.photos') }} ({{ photoResult.length }}{{ photosHasMore ? '+' : '' }})
                </div>
                <PhotoSearchResults
                  :photos="photoResult"
                  :has-more="photosHasMore"
                  :is-loading-more="isLoadingMorePhotos"
                  @load-more="loadMorePhotos"
                  @close="isOpen = false"
                />
              </div>
            </template>
            <template v-else>
              <div class="h-full flex flex-col items-center justify-center py-16 text-muted-foreground">
                <div class="relative mb-4">
                  <span class="i-lucide-search-x text-5xl text-muted" />
                </div>
                <span class="text-base font-medium">{{ t('searchDialog.noResults') }}</span>
              </div>
            </template>
          </div>
          <div v-else class="h-full flex flex-col items-center justify-center text-muted-foreground">
            <div class="relative mb-4">
              <span class="i-lucide-search text-5xl text-muted/50" />
            </div>
            <p class="text-base font-medium">
              {{ t('searchDialog.startTyping') }}
            </p>
            <p class="text-sm text-muted-foreground/60">
              {{ t('searchDialog.searchDescription') }}
            </p>
            <div class="mt-6 max-w-md w-full px-4 space-y-2">
              <button
                v-for="item in commandItems.slice(0, 3)"
                :key="item.id"
                class="w-full flex items-center gap-2 border border-border/60 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40"
                @click="item.action()"
              >
                <span :class="item.icon" class="h-4 w-4 text-primary" />
                <span>{{ item.title }}</span>
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </DialogContent>
  </Dialog>
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
