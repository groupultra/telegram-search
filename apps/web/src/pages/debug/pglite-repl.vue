<script setup lang="ts">
import { usePGliteDevDb } from '@tg-search/client'
import { markRaw, onMounted, ref } from 'vue'

import '@electric-sql/pglite-repl/webcomponent'

// Disable layout for this page
defineOptions({
  layout: false,
})

const pglite = ref<any>(null)
const replReady = ref(false)
const errorMessage = ref<string>()

onMounted(() => {
  // Try to get PGlite instance
  try {
    const db = usePGliteDevDb()
    if (db) {
      // Ensure the PGlite instance is not wrapped in a reactive Proxy,
      // which would break private field access inside the library.
      pglite.value = markRaw(db)
      replReady.value = true
    }
    else {
      // Wait for the database to be initialized
      let attempts = 0
      const maxAttempts = 50 // 5 seconds total

      const checkInterval = setInterval(() => {
        attempts++
        const db = usePGliteDevDb()
        if (db) {
          pglite.value = markRaw(db)
          replReady.value = true
          clearInterval(checkInterval)
        }
        else if (attempts >= maxAttempts) {
          errorMessage.value = 'Database not initialized. Please visit the main app first to initialize the database.'
          clearInterval(checkInterval)
        }
      }, 100)
    }
  }
  catch (error) {
    errorMessage.value = `Failed to get PGlite instance: ${error instanceof Error ? error.message : String(error)}`
  }
})
</script>

<template>
  <div class="h-screen w-screen flex flex-col bg-gray-50 dark:bg-gray-900">
    <!-- Header -->
    <header class="flex items-center justify-between border-b bg-white px-6 py-4 shadow-sm dark:bg-gray-800">
      <div class="flex items-center gap-3">
        <div class="i-lucide-database h-6 w-6 text-primary" />
        <h1 class="text-xl text-gray-900 font-bold dark:text-gray-100">
          PGlite Inspector
        </h1>
      </div>
      <div class="flex items-center gap-2">
        <a
          href="https://pglite.dev/docs/repl"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          <div class="i-lucide-book-open h-4 w-4" />
          Documentation
        </a>
        <router-link
          to="/"
          class="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          <div class="i-lucide-arrow-left h-4 w-4" />
          Back to App
        </router-link>
      </div>
    </header>

    <!-- Content -->
    <div class="flex-1 overflow-hidden">
      <!-- Error State -->
      <div v-if="errorMessage" class="h-full flex items-center justify-center">
        <div class="max-w-md text-center">
          <div class="i-lucide-alert-circle mb-4 h-12 w-12 text-red-500" />
          <h2 class="mb-2 text-xl text-gray-900 font-semibold dark:text-gray-100">
            Database Not Available
          </h2>
          <p class="mb-4 text-gray-600 dark:text-gray-400">
            {{ errorMessage }}
          </p>
          <router-link
            to="/"
            class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-white hover:bg-primary/90"
          >
            <div class="i-lucide-home h-4 w-4" />
            Go to Main App
          </router-link>
        </div>
      </div>

      <!-- Loading State -->
      <div v-else-if="!replReady" class="h-full flex items-center justify-center">
        <div class="text-center">
          <div class="i-lucide-loader-2 mb-4 h-8 w-8 animate-spin text-primary" />
          <p class="text-gray-600 dark:text-gray-400">
            Waiting for database initialization...
          </p>
          <p class="mt-2 text-sm text-gray-500 dark:text-gray-500">
            Make sure the main app is running
          </p>
        </div>
      </div>

      <!-- REPL State -->
      <div v-else class="h-full">
        <pglite-repl :pg="pglite" class="h-full w-full" />
      </div>
    </div>
  </div>
</template>

<style>
/* Ensure the REPL component fills the container */
pglite-repl {
  display: block;
  height: 100%;
  width: 100%;
}
</style>
