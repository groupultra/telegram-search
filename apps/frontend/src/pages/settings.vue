<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import SelectDropdown from '../components/ui/SelectDropdown.vue'
import { useSessionStore } from '../store/useSessionV2'
import { useSettingsStore } from '../store/useSettings'

const sessionStore = useSessionStore()
const { getWsContext } = sessionStore
const isEditing = ref(false)
const { config } = storeToRefs(useSettingsStore())
const wsContext = getWsContext()

const embeddingProviderOptions = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Ollama', value: 'ollama' },
]

async function updateConfig() {
  if (!config.value)
    return

  wsContext.sendEvent('config:update', { config: config.value })

  isEditing.value = false
  toast.success('Settings saved successfully')
}

onMounted(() => {
  wsContext.sendEvent('config:fetch')
})
</script>

<template>
  <div class="mx-auto p-4 container space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold dark:text-white">
        Settings
      </h1>
      <div class="space-x-2">
        <button
          v-if="!isEditing"
          class="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          @click="isEditing = true"
        >
          Edit
        </button>
        <template v-else>
          <button
            class="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
            @click="updateConfig"
          >
            Save
          </button>
        </template>
      </div>
    </div>

    <!-- Settings form -->
    <div class="space-y-6">
      <!-- Database settings -->
      <div class="border border-gray-200 rounded-lg p-4 dark:border-gray-800">
        <h2 class="mb-4 text-xl font-semibold dark:text-white">
          Database Settings
        </h2>
        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">Host</label>
            <input
              v-model="config.database.host"
              type="text"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
          </div>
          <div>
            <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">Port</label>
            <input
              v-model.number="config.database.port"
              type="number"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
          </div>
          <div>
            <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">Username</label>
            <input
              v-model="config.database.user"
              type="text"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
          </div>
          <div>
            <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">Password</label>
            <input
              v-model="config.database.password"
              type="password"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
          </div>
          <div class="md:col-span-2">
            <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">Database Name</label>
            <input
              v-model="config.database.database"
              type="text"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
          </div>
        </div>
      </div>

      <!-- Message settings -->
      <div class="border border-gray-200 rounded-lg p-4 dark:border-gray-800">
        <h2 class="mb-4 text-xl font-semibold dark:text-white">
          Message Settings
        </h2>
        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">Batch Size</label>
            <input
              v-model.number="config.message.export.batchSize"
              type="number"
              :min="1"
              :max="1000"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
          </div>
          <div>
            <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">Concurrent Requests</label>
            <input
              v-model.number="config.message.export.concurrent"
              type="number"
              :min="1"
              :max="10"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
          </div>
          <div>
            <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">Retry Times</label>
            <input
              v-model.number="config.message.export.retryTimes"
              type="number"
              :min="1"
              :max="10"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
          </div>
          <div>
            <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">Max Takeout Retries</label>
            <input
              v-model.number="config.message.export.maxTakeoutRetries"
              type="number"
              :min="1"
              :max="10"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
          </div>
        </div>
      </div>

      <!-- Path settings -->
      <div class="border border-gray-200 rounded-lg p-4 dark:border-gray-800">
        <h2 class="mb-4 text-xl font-semibold dark:text-white">
          Path Settings
        </h2>
        <div class="grid gap-4">
          <div>
            <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">Storage Path</label>
            <input
              v-model="config.path.storage"
              type="text"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
          </div>
        </div>
      </div>

      <!-- API settings -->
      <div class="border border-gray-200 rounded-lg p-4 dark:border-gray-800">
        <h2 class="mb-4 text-xl font-semibold dark:text-white">
          API Settings
        </h2>
        <div class="space-y-4">
          <!-- Telegram API -->
          <div>
            <h3 class="mb-2 text-lg font-medium dark:text-white">
              Telegram API
            </h3>
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">API ID</label>
                <input
                  v-model="config.api.telegram.apiId"
                  type="text"
                  :disabled="!isEditing"
                  class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
              </div>
              <div>
                <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">API Hash</label>
                <input
                  v-model="config.api.telegram.apiHash"
                  type="password"
                  :disabled="!isEditing"
                  class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
              </div>
              <div class="md:col-span-2">
                <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">Phone Number</label>
                <input
                  v-model="config.api.telegram.phoneNumber"
                  type="tel"
                  :disabled="!isEditing"
                  class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
              </div>
            </div>
          </div>

          <!-- OpenAI API -->
          <div>
            <h3 class="mb-2 text-lg font-medium dark:text-white">
              Embedding
            </h3>
            <div class="grid gap-4">
              <div>
                <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">Provider</label>
                <SelectDropdown v-model="config.api.embedding.provider" :options="embeddingProviderOptions" :disabled="!isEditing" />
              </div>
              <div>
                <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">Model</label>
                <input
                  v-model="config.api.embedding.model"
                  :disabled="!isEditing"
                  class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
              </div>
              <div>
                <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">API Key</label>
                <input
                  v-model="config.api.embedding.apiKey"
                  type="password"
                  :disabled="!isEditing"
                  class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
              </div>
              <div>
                <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">API Base URL</label>
                <input
                  v-model="config.api.embedding.apiBase"
                  type="text"
                  :disabled="!isEditing"
                  class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
