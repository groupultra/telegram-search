<script setup lang="ts">
import type { CoreRetrievalMessages, CoreRetrievalPhoto } from '@tg-search/core/types'

import { useBridge } from '@tg-search/client'
import { CoreEventType } from '@tg-search/core'
import { useDebounce } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import MessageList from './messages/MessageList.vue'
import PhotoSearchResults from './PhotoSearchResults.vue'

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
  <!-- Background overlay -->
  <Transition
    enter-active-class="transition-opacity duration-200 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-150 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
      @click="isOpen = false"
    />
  </Transition>

  <!-- Dialog content -->
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 scale-95 translate-y-4"
    enter-to-class="opacity-100 scale-100 translate-y-0"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="opacity-100 scale-100 translate-y-0"
    leave-to-class="opacity-0 scale-95 translate-y-4"
  >
    <div
      v-if="isOpen"
      class="fixed inset-x-0 top-0 z-50 mx-auto h-full w-full md:top-[15%] md:h-auto md:max-w-2xl md:w-[90%] md:px-4"
      @keydown.esc="isOpen = false"
    >
      <div class="h-full w-full flex flex-col overflow-hidden border-0 rounded-none bg-card shadow-2xl backdrop-blur-xl md:h-auto md:border dark:border-gray-700 md:rounded-2xl dark:bg-gray-800/95" @click.stop>
        <!-- Search input box -->
        <div class="bg-linear-to-b border-b from-background/50 to-background p-4 dark:border-gray-700 md:p-6">
          <div class="flex items-center gap-3">
            <button
              class="flex shrink-0 items-center justify-center rounded-full p-2 transition-colors hover:bg-accent md:hidden"
              @click="isOpen = false"
            >
              <span class="i-lucide-arrow-left h-5 w-5" />
            </button>
            <div class="relative flex flex-1 items-center">
              <div class="absolute left-4 flex items-center justify-center">
                <span class="i-lucide-search h-5 w-5 text-muted-foreground" />
              </div>
              <input
                v-model="keyword"
                class="h-12 w-full border-0 rounded-xl bg-muted/50 px-4 pl-12 pr-4 text-base transition-all duration-200 md:h-14 focus:bg-muted/80 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                :placeholder="t('searchDialog.searchMessages')"
                autofocus
              >
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
          class="flex-1 overflow-y-auto md:max-h-[60vh] md:flex-initial"
          :class="keywordDebounced ? 'md:min-h-[300px]' : 'md:min-h-[200px]'"
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
                  />
                  <div v-else class="h-full flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <div class="mb-4 h-16 w-16 flex items-center justify-center rounded-full bg-muted">
                      <span class="i-lucide-message-square text-3xl" />
                    </div>
                    <span class="text-base font-medium">{{ t('searchDialog.noRelatedMessages') }}</span>
                  </div>
                </div>

                <!-- Photos Tab -->
                <div v-if="activeTab === 'photos'" class="h-full">
                  <PhotoSearchResults v-if="photoResult.length > 0" :photos="photoResult" :has-more="photosHasMore" :is-loading-more="isLoadingMorePhotos" @load-more="loadMorePhotos" />
                  <div v-else class="h-full flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <div class="mb-4 h-16 w-16 flex items-center justify-center rounded-full bg-muted">
                      <span class="i-lucide-image text-3xl" />
                    </div>
                    <span class="text-base font-medium">{{ t('searchDialog.noRelatedPhotos') }}</span>
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="h-full flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <div class="mb-4 h-16 w-16 flex items-center justify-center rounded-full bg-muted">
                    <span class="i-lucide-search text-3xl" />
                  </div>
                  <span class="text-base font-medium">{{ t('searchDialog.noResults') }}</span>
                </div>
              </template>
            </div>
            <div v-else class="h-full flex flex-col items-center justify-center py-16 text-muted-foreground">
              <div class="mb-4 h-16 w-16 flex items-center justify-center rounded-full bg-muted">
                <span class="i-lucide-search text-3xl" />
              </div>
              <span class="text-base font-medium">{{ t('searchDialog.searchMessages') }}</span>
              <span class="mt-2 text-sm opacity-60">{{ t('searchDialog.startTyping') }}</span>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </Transition>
</template>
