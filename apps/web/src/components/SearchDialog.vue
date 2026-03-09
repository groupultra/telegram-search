<script setup lang="ts">
import type { CoreRetrievalMessages, CoreRetrievalPhoto } from '@tg-search/core/types'

import { useBridge } from '@tg-search/client'
import { CoreEventType } from '@tg-search/core'
import { useDebounce } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import MessageList from './messages/MessageList.vue'
import PhotoSearchResults from './PhotoSearchResults.vue'

import { Button } from './ui/Button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from './ui/Dialog'
import { Input } from './ui/Input'

const props = defineProps<{
  chatId?: string
}>()

const { t } = useI18n()

const isOpen = defineModel<boolean>('open', { required: true })
const isLoading = ref(false)

const keyword = ref<string>('')
const keywordDebounced = useDebounce(keyword, 1000)

const bridge = useBridge()
const searchResult = ref<CoreRetrievalMessages[]>([])
const photoResult = ref<CoreRetrievalPhoto[]>([])

const activeTab = ref<'messages' | 'photos'>('messages')
const hasResults = computed(() => searchResult.value.length > 0 || photoResult.value.length > 0)

const SEARCH_LIMIT = 10
const messagesHasMore = ref(false)
const photosHasMore = ref(false)
const isLoadingMoreMessages = ref(false)
const isLoadingMorePhotos = ref(false)
let messagesOffset = 0
let photosOffset = 0
let requestSeq = 0

watch(keywordDebounced, (newKeyword) => {
  if (newKeyword.length === 0) {
    searchResult.value = []
    photoResult.value = []
    messagesHasMore.value = false
    photosHasMore.value = false
    messagesOffset = 0
    photosOffset = 0
    requestSeq += 1
    return
  }

  const currentRequest = ++requestSeq
  isLoading.value = true
  messagesOffset = 0
  photosOffset = 0

  // Search messages
  bridge.sendEvent(CoreEventType.StorageSearchMessages, {
    chatId: props.chatId,
    content: newKeyword,
    useVector: true,
    pagination: {
      limit: SEARCH_LIMIT,
      offset: 0,
    },
  })

  // Search photos
  bridge.sendEvent(CoreEventType.StorageSearchPhotos, {
    content: newKeyword,
    useVector: true,
    pagination: {
      limit: SEARCH_LIMIT,
      offset: 0,
    },
    chatIds: props.chatId ? [props.chatId] : undefined,
  })

  // Wait for both results
  Promise.all([
    bridge.waitForEvent(CoreEventType.StorageSearchMessagesData),
    bridge.waitForEvent(CoreEventType.StorageSearchPhotosData),
  ]).then(([messagesData, photosData]) => {
    if (currentRequest !== requestSeq)
      return

    searchResult.value = messagesData.messages
    photoResult.value = photosData.photos
    messagesHasMore.value = messagesData.hasMore
    photosHasMore.value = photosData.hasMore
    messagesOffset = messagesData.messages.length
    photosOffset = photosData.photos.length
    isLoading.value = false

    // Auto-switch to tab with results
    if (messagesData.messages.length === 0 && photosData.photos.length > 0) {
      activeTab.value = 'photos'
    }
    else {
      activeTab.value = 'messages'
    }
  })
})

async function loadMoreMessages() {
  const currentKeyword = keywordDebounced.value.trim()
  if (!currentKeyword || isLoadingMoreMessages.value || !messagesHasMore.value)
    return

  const currentRequest = ++requestSeq
  isLoadingMoreMessages.value = true

  bridge.sendEvent(CoreEventType.StorageSearchMessages, {
    chatId: props.chatId,
    content: currentKeyword,
    useVector: true,
    pagination: {
      limit: SEARCH_LIMIT,
      offset: messagesOffset,
    },
  })

  try {
    const result = await bridge.waitForEvent(CoreEventType.StorageSearchMessagesData)
    if (currentRequest !== requestSeq)
      return

    searchResult.value = [...searchResult.value, ...result.messages]
    messagesHasMore.value = result.hasMore
    messagesOffset += result.messages.length
  }
  finally {
    if (currentRequest === requestSeq) {
      isLoadingMoreMessages.value = false
    }
  }
}

async function loadMorePhotos() {
  const currentKeyword = keywordDebounced.value.trim()
  if (!currentKeyword || isLoadingMorePhotos.value || !photosHasMore.value)
    return

  const currentRequest = ++requestSeq
  isLoadingMorePhotos.value = true

  bridge.sendEvent(CoreEventType.StorageSearchPhotos, {
    content: currentKeyword,
    useVector: true,
    pagination: {
      limit: SEARCH_LIMIT,
      offset: photosOffset,
    },
    chatIds: props.chatId ? [props.chatId] : undefined,
  })

  try {
    const result = await bridge.waitForEvent(CoreEventType.StorageSearchPhotosData)
    if (currentRequest !== requestSeq)
      return

    photoResult.value = [...photoResult.value, ...result.photos]
    photosHasMore.value = result.hasMore
    photosOffset += result.photos.length
  }
  finally {
    if (currentRequest === requestSeq) {
      isLoadingMorePhotos.value = false
    }
  }
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="h-full max-w-3xl gap-0 overflow-hidden border-0 rounded-none bg-background/95 p-0 backdrop-blur-xl md:h-auto md:max-h-[85vh] md:border md:rounded-2xl">
      <DialogTitle class="sr-only">
        {{ t('searchDialog.searchMessages') }}
      </DialogTitle>

      <!-- Search input box -->
      <div class="border-b bg-background/50 p-4 backdrop-blur-sm md:p-6">
        <div class="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            class="rounded-full md:hidden"
            @click="isOpen = false"
          >
            <span class="i-lucide-arrow-left h-5 w-5" />
          </Button>
          <div class="relative flex flex-1 items-center">
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
      </div>

      <!-- Tabs (only show when has results) -->
      <div v-if="keywordDebounced && hasResults && !isLoading" class="flex items-center gap-1 border-b px-4">
        <button
          class="relative px-4 py-3 text-sm font-medium transition-colors"
          :class="activeTab === 'messages' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'messages'"
        >
          <span class="flex items-center gap-2">
            <span class="i-lucide-message-square h-4 w-4" />
            <span>{{ t('searchDialog.messages') }}</span>
            <span v-if="searchResult.length > 0" class="rounded-full bg-primary/10 px-2 py-0.5 text-xs">
              {{ searchResult.length }}{{ messagesHasMore ? '+' : '' }}
            </span>
          </span>
          <div
            v-if="activeTab === 'messages'"
            class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
          />
        </button>
        <button
          class="relative px-4 py-3 text-sm font-medium transition-colors"
          :class="activeTab === 'photos' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'"
          @click="activeTab = 'photos'"
        >
          <span class="flex items-center gap-2">
            <span class="i-lucide-image h-4 w-4" />
            <span>{{ t('searchDialog.photos') }}</span>
            <span v-if="photoResult.length > 0" class="rounded-full bg-primary/10 px-2 py-0.5 text-xs">
              {{ photoResult.length }}{{ photosHasMore ? '+' : '' }}
            </span>
          </span>
          <div
            v-if="activeTab === 'photos'"
            class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
          />
        </button>
      </div>

      <!-- Search results -->
      <div
        class="min-h-[300px] flex-1 overflow-y-auto"
      >
        <Transition
          enter-active-class="transition-all duration-300 ease-out"
          enter-from-class="opacity-0 translate-y-2"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-200 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 translate-y-2"
          mode="out-in"
        >
          <div v-if="keywordDebounced" class="h-full">
            <template v-if="isLoading">
              <div class="h-full flex flex-col items-center justify-center py-16 text-muted-foreground">
                <div class="relative mb-4">
                  <span class="i-lucide-loader-circle animate-spin text-5xl text-primary" />
                </div>
                <span class="text-base font-medium">{{ t('searchDialog.searching') }}</span>
              </div>
            </template>
            <template v-else-if="hasResults">
              <!-- Messages Tab -->
              <div v-if="activeTab === 'messages'" class="h-full">
                <MessageList
                  v-if="searchResult.length > 0"
                  :messages="searchResult"
                  :keyword="keyword"
                  :has-more="messagesHasMore"
                  :is-loading-more="isLoadingMoreMessages"
                  @load-more="loadMoreMessages"
                  @close="isOpen = false"
                />
              </div>

              <!-- Photos Tab -->
              <div v-if="activeTab === 'photos'" class="h-full">
                <PhotoSearchResults
                  v-if="photoResult.length > 0"
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
          </div>
        </Transition>
      </div>
    </DialogContent>
  </Dialog>
</template>
