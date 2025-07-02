<script setup lang="ts">
import { useSettingsStore, useWebsocketStore } from '@tg-search/client'
import { storeToRefs } from 'pinia'
import { onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'

import { Button } from '../components/ui/Button'
import SelectDropdown from '../components/ui/SelectDropdown.vue'

const isEditing = ref(false)
const { config } = storeToRefs(useSettingsStore())
const websocketStore = useWebsocketStore()

const embeddingProviderOptions = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Ollama', value: 'ollama' },
]

async function updateConfig() {
  if (!config.value)
    return

  websocketStore.sendEvent('config:update', { config: config.value })

  isEditing.value = false
  toast.success('Settings saved successfully')
}

onMounted(() => {
  websocketStore.sendEvent('config:fetch')
})
</script>

<template>
  <header class="flex items-center border-b border-b-secondary p-4 px-4 dark:border-b-secondary">
    <div class="flex items-center gap-2">
      <span class="text-lg font-medium">Settings</span>
    </div>

    <div class="ml-auto flex items-center gap-2">
      <Button
        icon="i-lucide-pencil"
        :disabled="isEditing"
        @click="isEditing = !isEditing"
      >
        Edit
      </Button>

      <Button
        icon="i-lucide-save"
        :disabled="!isEditing"
        @click="updateConfig"
      >
        Save
      </Button>
    </div>
  </header>

  <div class="container mx-auto p-4 space-y-6">
    <!-- Settings form -->
    <div class="space-y-6">
      <!-- Database settings -->
      <div class="border border-neutral-200 rounded-lg bg-card p-4">
        <h2 class="mb-4 text-xl text-primary-900 font-semibold">
          Database Settings
        </h2>
        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="block text-sm text-complementary-600 font-medium">Host</label>
            <input
              v-model="config.database.host"
              type="text"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 text-primary-900"
            >
          </div>
          <div>
            <label class="block text-sm text-complementary-600 font-medium">Port</label>
            <input
              v-model.number="config.database.port"
              type="number"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 text-primary-900"
            >
          </div>
          <div>
            <label class="block text-sm text-complementary-600 font-medium">Username</label>
            <input
              v-model="config.database.user"
              type="text"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 text-primary-900"
            >
          </div>
          <div>
            <label class="block text-sm text-complementary-600 font-medium">Password</label>
            <input
              v-model="config.database.password"
              type="password"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 text-primary-900"
            >
          </div>
          <div class="md:col-span-2">
            <label class="block text-sm text-complementary-600 font-medium">Database Name</label>
            <input
              v-model="config.database.database"
              type="text"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 text-primary-900"
            >
          </div>
        </div>
      </div>

      <!-- Message settings -->
      <div class="border border-neutral-200 rounded-lg bg-card p-4">
        <h2 class="mb-4 text-xl text-primary-900 font-semibold">
          Message Settings
        </h2>
        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="block text-sm text-complementary-600 font-medium">Batch Size</label>
            <input
              v-model.number="config.message.export.batchSize"
              type="number"
              :min="1"
              :max="1000"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 text-primary-900"
            >
          </div>
          <div>
            <label class="block text-sm text-complementary-600 font-medium">Concurrent Requests</label>
            <input
              v-model.number="config.message.export.concurrent"
              type="number"
              :min="1"
              :max="10"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 text-primary-900"
            >
          </div>
          <div>
            <label class="block text-sm text-complementary-600 font-medium">Retry Times</label>
            <input
              v-model.number="config.message.export.retryTimes"
              type="number"
              :min="1"
              :max="10"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 text-primary-900"
            >
          </div>
          <div>
            <label class="block text-sm text-complementary-600 font-medium">Max Takeout Retries</label>
            <input
              v-model.number="config.message.export.maxTakeoutRetries"
              type="number"
              :min="1"
              :max="10"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 text-primary-900"
            >
          </div>
        </div>
      </div>

      <!-- Path settings -->
      <div class="border border-neutral-200 rounded-lg bg-card p-4">
        <h2 class="mb-4 text-xl text-primary-900 font-semibold">
          Path Settings
        </h2>
        <div class="grid gap-4">
          <div>
            <label class="block text-sm text-complementary-600 font-medium">Storage Path</label>
            <input
              v-model="config.path.storage"
              type="text"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 text-primary-900"
            >
          </div>
        </div>
      </div>

      <!-- API settings -->
      <div class="border border-neutral-200 rounded-lg bg-card p-4">
        <h2 class="mb-4 text-xl text-primary-900 font-semibold">
          API Settings
        </h2>
        <div class="space-y-4">
          <!-- Telegram API -->
          <div>
            <h3 class="mb-2 text-lg text-primary-900 font-medium">
              Telegram API
            </h3>
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <label class="block text-sm text-complementary-600 font-medium">API ID</label>
                <input
                  v-model="config.api.telegram.apiId"
                  type="text"
                  :disabled="!isEditing"
                  class="mt-1 block w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 text-primary-900"
                >
              </div>
              <div>
                <label class="block text-sm text-complementary-600 font-medium">API Hash</label>
                <input
                  v-model="config.api.telegram.apiHash"
                  type="password"
                  :disabled="!isEditing"
                  class="mt-1 block w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 text-primary-900"
                >
              </div>
            </div>
          </div>

          <!-- OpenAI API -->
          <div>
            <h3 class="mb-2 text-lg text-primary-900 font-medium">
              Embedding
            </h3>
            <div class="grid gap-4">
              <div>
                <label class="block text-sm text-complementary-600 font-medium">Provider</label>
                <SelectDropdown v-model="config.api.embedding.provider" :options="embeddingProviderOptions" :disabled="!isEditing" />
              </div>
              <div>
                <label class="block text-sm text-complementary-600 font-medium">Model</label>
                <input
                  v-model="config.api.embedding.model"
                  :disabled="!isEditing"
                  class="mt-1 block w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 text-primary-900"
                >
              </div>
              <div>
                <label class="block text-sm text-complementary-600 font-medium">Dimension</label>
                <input
                  v-model="config.api.embedding.dimension"
                  :disabled="!isEditing"
                  class="mt-1 block w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 text-primary-900"
                >
              </div>
              <div>
                <label class="block text-sm text-complementary-600 font-medium">API Key</label>
                <input
                  v-model="config.api.embedding.apiKey"
                  type="password"
                  :disabled="!isEditing"
                  class="mt-1 block w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 text-primary-900"
                >
              </div>
              <div>
                <label class="block text-sm text-complementary-600 font-medium">API Base URL</label>
                <input
                  v-model="config.api.embedding.apiBase"
                  type="text"
                  :disabled="!isEditing"
                  class="mt-1 block w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 text-primary-900"
                >
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
