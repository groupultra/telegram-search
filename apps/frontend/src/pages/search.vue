<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { toast, Toaster } from 'vue-sonner'
import { useSearch } from '../apis/commands/useSearch'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

// Get chat ID from route query
const chatId = route.query.chatId ? Number(route.query.chatId) : undefined

const {
  query,
  isLoading,
  isStreaming,
  results,
  total,
  error,
  currentPage,
  pageSize,
  progress,
  search: doSearch,
  changePage: handlePageChange,
  useVectorSearch,
} = useSearch()

// Handle search with chat ID
async function handleSearch() {
  const toastId = toast.loading(t('pages.search.searching'))

  try {
    const result = await doSearch({
      chatId,
    })

    if (!result.success) {
      toast.error(result.error?.message || t('pages.search.search_failed'), { id: toastId })
    }
    else {
      toast.success(t('pages.search.found_results', { total: result.total }), { id: toastId })
    }
  }
  catch (err) {
    toast.error(`${t('pages.search.search_failed')}: ${err instanceof Error ? err.message : t('pages.search.error_unknown')}`, { id: toastId })
  }
}

// Format score for display
function formatScore(score: number): string {
  if (score >= 1)
    return t('pages.search.match_score.perfect')
  return t('pages.search.match_score.similarity', { score: (score * 100).toFixed(1) })
}

// Format date for display
function formatDate(date: string | Date): string {
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="mx-auto px-4 py-8 container">
    <!-- Toaster -->
    <Toaster position="top-right" :expand="true" :rich-colors="true" />

    <!-- Search header -->
    <div class="mb-8 flex items-center gap-4">
      <button
        class="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
        @click="router.back()"
      >
        <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </button>
      <h1 class="text-2xl font-bold">
        {{ t('pages.search.title') }}
      </h1>
    </div>

    <!-- Search form -->
    <form class="mb-8" @submit.prevent="handleSearch">
      <div class="flex flex-col gap-4">
        <div class="flex gap-4">
          <input
            v-model="query"
            type="search"
            :placeholder="t('pages.search.search_placeholder')"
            class="flex-1 border rounded-lg px-4 py-2 dark:border-gray-700 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            :disabled="isLoading"
          >
          <button
            type="submit"
            class="rounded-lg bg-blue-500 px-6 py-2 text-white hover:bg-blue-600 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            :disabled="isLoading || !query.trim()"
          >
            {{ isLoading ? t('pages.search.searching') : t('pages.search.search') }}
          </button>
        </div>
        <div class="flex items-center justify-between rounded-lg px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-800">
          <label class="text-sm text-gray-600 dark:text-gray-400">
            {{ t('pages.search.use_vector_search') }}
            <span class="text-xs text-gray-500">{{ t('pages.search.vector_search_tip') }}</span>
          </label>
          <button
            type="button"
            role="switch"
            :aria-checked="useVectorSearch"
            class="relative h-6 w-11 inline-flex items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            :class="useVectorSearch ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'"
            @click="useVectorSearch = !useVectorSearch"
          >
            <span class="sr-only">{{ t('pages.search.use_vector_search') }}</span>
            <span
              class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200"
              :class="useVectorSearch ? 'translate-x-6' : 'translate-x-1'"
            />
          </button>
        </div>
      </div>
    </form>

    <!-- Search progress -->
    <div v-if="isStreaming || progress > 0" class="mb-8 space-y-4">
      <!-- Progress bar -->
      <div class="h-2.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          class="h-2.5 rounded-full bg-blue-600 transition-all duration-300"
          :style="{ width: isStreaming ? '90%' : '100%' }"
        />
      </div>

      <!-- Progress logs -->
      <!-- <div class="rounded-lg bg-gray-50 p-4 space-y-2 dark:bg-gray-800">
        <div
          v-for="(log, index) in searchProgress"
          :key="index"
          class="text-sm text-gray-600 dark:text-gray-400"
        >
          {{ log }}
        </div>
      </div> -->
    </div>

    <!-- Error message -->
    <div
      v-if="error"
      class="mb-8 border border-red-200 rounded-lg bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
    >
      {{ error instanceof Error ? error.message : error }}
    </div>

    <!-- Search results -->
    <div v-if="results.length > 0" class="space-y-4">
      <!-- Results count -->
      <div class="text-sm text-gray-500 dark:text-gray-400">
        {{ t('pages.search.found_results', { total }) }}
        <span v-if="isStreaming">{{ t('pages.search.searching_status') }}</span>
      </div>

      <div
        v-for="message in results"
        :key="message.id"
        class="cursor-pointer border rounded-lg p-4 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
        @click="router.push(`/chat/${message.chatId}#message-${message.id}`)"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <p class="text-gray-600 dark:text-gray-400">
                {{ message.fromName || t('pages.search.unknown_user') }}
              </p>
              <span class="text-sm text-gray-500 dark:text-gray-500">
                {{ formatDate(message.createdAt) }}
              </span>
              <span
                class="rounded px-2 py-0.5 text-xs"
                :class="{
                  'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100': message.score >= 1,
                  'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100': message.score < 1,
                }"
              >
                {{ formatScore(message.score) }}
              </span>
            </div>
            <p class="mt-1 whitespace-pre-wrap dark:text-gray-300">
              <HighlightText
                :content="message.content || ''"
                :query="query"
              />
            </p>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="total > pageSize" class="mt-8 flex justify-center">
        <nav class="flex items-center gap-2">
          <button
            v-for="page in Math.ceil(total / pageSize)"
            :key="page"
            class="rounded-lg px-3 py-1"
            :class="{
              'bg-blue-500 text-white': page === currentPage,
              'hover:bg-gray-100 dark:hover:bg-gray-800': page !== currentPage,
            }"
            @click="handlePageChange(page)"
          >
            {{ page }}
          </button>
        </nav>
      </div>
    </div>

    <!-- No results -->
    <div
      v-else-if="!isLoading && query.trim()"
      class="py-8 text-center text-gray-500 dark:text-gray-400"
    >
      {{ t('pages.search.no_results') }}
    </div>
  </div>
</template>
