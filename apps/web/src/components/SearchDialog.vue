<script setup lang="ts">
import type { CoreRetrievalMessages } from '@tg-search/core/types'

import { useBridge } from '@tg-search/client'
import { CoreEventType } from '@tg-search/core'
import { useDebounce } from '@vueuse/core'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import MessageList from './messages/MessageList.vue'

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

// TODO: Infinite scroll
watch(keywordDebounced, (newKeyword) => {
  if (newKeyword.length === 0) {
    searchResult.value = []
    return
  }

  isLoading.value = true
  bridge.sendEvent(CoreEventType.StorageSearchMessages, {
    chatId: props.chatId,
    content: newKeyword,
    useVector: true,
    pagination: {
      limit: 10,
      offset: 0,
    },
  })

  bridge.waitForEvent(CoreEventType.StorageSearchMessagesData).then(({ messages }) => {
    searchResult.value = messages
    isLoading.value = false
  })
})
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
          >
            <div v-if="keywordDebounced" class="h-full">
              <template v-if="searchResult.length > 0">
                <MessageList :messages="searchResult" :keyword="keyword" />
              </template>
              <template v-else-if="isLoading">
                <div class="h-full flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <div class="relative mb-4">
                    <span class="i-lucide-loader-circle animate-spin text-5xl text-primary" />
                  </div>
                  <span class="text-base font-medium">{{ t('searchDialog.searching') }}</span>
                </div>
              </template>
              <template v-else-if="searchResult.length === 0">
                <div class="h-full flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <div class="mb-4 h-16 w-16 flex items-center justify-center rounded-full bg-muted">
                    <span class="i-lucide-search text-3xl" />
                  </div>
                  <span class="text-base font-medium">{{ t('searchDialog.noRelatedMessages') }}</span>
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
