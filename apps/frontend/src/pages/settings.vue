<script setup lang="ts">
import type { Config } from '@tg-search/common'
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast, Toaster } from 'vue-sonner'
import SelectDropdown from '../components/ui/SelectDropdown.vue'
import { useConfigStore } from '../store/useConfig'

// Initialize config store
const configStore = useConfigStore()
const { config, loading, error } = storeToRefs(useConfigStore())
const { t } = useI18n()
const isEditing = ref(false)
const validationError = ref<string | null>(null)

//
// Validate number fields
function validateNumberField(value: number, fieldName: string, min = 1, max = 1000): string | null {
  if (Number.isNaN(value)) {
    return t('pages.settings.number_is_nan', { fieldName })
  }
  if (value < min) {
    return t('pages.settings.number_lt_min', { fieldName, min })
  }
  if (value > max) {
    return t('pages.settings.number_gt_max', { fieldName, max })
  }
  return null
}

const embeddingProviderOptions = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Ollama', value: 'ollama' },
]

// Validate all number fields
function validateConfig(config: Config): string | null {
  const fields = [
    { value: config.message.export.batchSize, name: t('pages.settings.batch_size'), max: 1000 },
    { value: config.message.export.concurrent, name: 'pages.settings.concurrent_requests', max: 10 },
    { value: config.message.export.retryTimes, name: 'pages.settings.retry_times', max: 10 },
    { value: config.message.export.maxTakeoutRetries, name: 'pages.settings.max_takeout_retries', max: 10 },
  ]

  for (const field of fields) {
    const error = validateNumberField(field.value, field.name, 1, field.max)
    if (error)
      return error
  }

  return null
}

// Handle number input
function handleNumberInput(event: Event, path: string[]) {
  const input = event.target as HTMLInputElement
  const value = Number(input.value)

  if (!config.value)
    return

  // Use lodash get and set to safely access and modify nested properties
  let target = config.value
  for (let i = 0; i < path.length - 1; i++) {
    target = target[path[i] as keyof typeof target] as any
  }

  const lastKey = path[path.length - 1]
  target[lastKey as keyof typeof target] = value as any

  // Validate new value
  validationError.value = validateNumberField(value, lastKey)
}

// Load config
async function loadConfig() {
  try {
    await configStore.fetchConfig()
  }
  catch (err) {
    console.error('Failed to load config:', err)
    toast.error(t('pages.settings.config_error', { error: err instanceof Error ? err.message : 'Unknown error' }))
  }
}

// Save config
async function saveConfig() {
  if (!config.value)
    return

  try {
    // Ensure all number fields have correct type
    const safeConfig: Config = {
      ...config.value,
      database: {
        ...config.value.database,
        port: Number(config.value.database.port),
      },
      message: {
        export: {
          batchSize: Number(config.value.message.export.batchSize),
          concurrent: Number(config.value.message.export.concurrent),
          retryTimes: Number(config.value.message.export.retryTimes),
          maxTakeoutRetries: Number(config.value.message.export.maxTakeoutRetries),
        },
        batch: {
          size: Number(config.value.message.batch.size),
        },
      },
      api: {
        ...config.value.api,
        telegram: {
          ...config.value.api.telegram,
          apiId: config.value.api.telegram.apiId.toString(),
        },
      },
    }

    // Validate config
    const configValidationError = validateConfig(safeConfig)
    if (configValidationError) {
      toast.error(configValidationError)
      return
    }
    await configStore.updateConfig(safeConfig)
    isEditing.value = false
    toast.success(t('pages.settings.save_success'))

    // Fix: Only set validationError if it exists
    if (validationError.value && validationError.value !== undefined)
      validationError.value = null
  }
  catch (err) {
    console.error('Failed to save config:', err)
    toast.error(t('pages.settings.save_config_error', { error: err instanceof Error ? err.message : 'Unknown error' }))
  }
}

// Reset config
function resetConfig() {
  isEditing.value = false
  // Fix: Only set validationError if it exists
  if (validationError.value && validationError.value !== undefined)
    validationError.value = null

  loadConfig()
  toast(t('pages.settings.reset_config'))
}

// Load initial config
loadConfig()
</script>

<template>
  <div class="mx-auto p-4 container space-y-6">
    <Toaster position="top-right" rich-colors />
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold dark:text-white">
        {{ $t('pages.settings.settings') }}
      </h1>
      <div class="space-x-2">
        <button
          v-if="!isEditing"
          class="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          @click="isEditing = true"
        >
          {{ $t('pages.settings.edit') }}
        </button>
        <template v-else>
          <button
            class="rounded-lg bg-gray-500 px-4 py-2 text-white hover:bg-gray-600"
            @click="resetConfig"
          >
            {{ $t('pages.settings.cancel') }}
          </button>
          <button
            class="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
            @click="saveConfig"
          >
            {{ $t('pages.settings.save') }}
          </button>
        </template>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="text-center text-gray-500 dark:text-gray-400">
      {{ $t('pages.settings.loading') }}
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="text-center text-red-500 dark:text-red-400">
      {{ error }}
    </div>

    <!-- Validation error -->
    <div v-if="validationError" class="mt-2 text-sm text-red-500">
      {{ validationError }}
    </div>

    <!-- Settings form -->
    <div v-else-if="config" class="space-y-6">
      <!-- Database settings -->
      <div class="border border-gray-200 rounded-lg p-4 dark:border-gray-800">
        <h2 class="mb-4 text-xl font-semibold dark:text-white">
          {{ $t('pages.settings.database_settings') }}
        </h2>
        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">{{ $t('pages.settings.host') }}</label>
            <input
              v-model="config.database.host"
              type="text"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
          </div>
          <div>
            <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">{{ $t('pages.settings.port') }}</label>
            <input
              v-model.number="config.database.port"
              type="number"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
          </div>
          <div>
            <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">{{ $t('pages.settings.username') }}</label>
            <input
              v-model="config.database.user"
              type="text"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
          </div>
          <div>
            <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">{{ $t('pages.settings.password') }}</label>
            <input
              v-model="config.database.password"
              type="password"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
          </div>
          <div class="md:col-span-2">
            <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">{{ $t('pages.settings.database_name') }}</label>
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
          {{ $t("pages.settings.message_settings") }}
        </h2>
        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">{{ $t('pages.settings.batch_size') }}</label>
            <input
              v-model.number="config.message.export.batchSize"
              type="number"
              :min="1"
              :max="1000"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              @input="(e: Event) => handleNumberInput(e, ['message', 'export', 'batchSize'])"
            >
          </div>
          <div>
            <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">{{ $t('pages.settings.concurrent_requests') }}</label>
            <input
              v-model.number="config.message.export.concurrent"
              type="number"
              :min="1"
              :max="10"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              @input="(e: Event) => handleNumberInput(e, ['message', 'export', 'concurrent'])"
            >
          </div>
          <div>
            <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">{{ $t('pages.settings.retry_times') }}</label>
            <input
              v-model.number="config.message.export.retryTimes"
              type="number"
              :min="1"
              :max="10"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              @input="(e: Event) => handleNumberInput(e, ['message', 'export', 'retryTimes'])"
            >
          </div>
          <div>
            <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">{{ $t('pages.settings.max_takeout_retries') }}</label>
            <input
              v-model.number="config.message.export.maxTakeoutRetries"
              type="number"
              :min="1"
              :max="10"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              @input="(e: Event) => handleNumberInput(e, ['message', 'export', 'maxTakeoutRetries'])"
            >
          </div>
        </div>
      </div>

      <!-- Path settings -->
      <div class="border border-gray-200 rounded-lg p-4 dark:border-gray-800">
        <h2 class="mb-4 text-xl font-semibold dark:text-white">
          {{ $t('pages.settings.path_settings') }}
        </h2>
        <div class="grid gap-4">
          <div>
            <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">{{ $t('pages.settings.storage_path') }}</label>
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
          {{ $t('pages.settings.api_settings') }}
        </h2>
        <div class="space-y-4">
          <!-- Telegram API -->
          <div>
            <h3 class="mb-2 text-lg font-medium dark:text-white">
              {{ $t('pages.settings.telegram_api') }}
            </h3>
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">{{ $t('pages.settings.api_id') }}</label>
                <input
                  v-model="config.api.telegram.apiId"
                  type="text"
                  :disabled="!isEditing"
                  class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
              </div>
              <div>
                <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">{{ $t('pages.settings.api_hash') }}</label>
                <input
                  v-model="config.api.telegram.apiHash"
                  type="password"
                  :disabled="!isEditing"
                  class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
              </div>
              <div class="md:col-span-2">
                <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">{{ $t('pages.settings.phone_number') }}</label>
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
              {{ $t('pages.settings.embedding') }}
            </h3>
            <div class="grid gap-4">
              <div>
                <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">{{ $t('pages.settings.provider') }}</label>
                <SelectDropdown v-model="config.api.embedding.provider" :options="embeddingProviderOptions" :disabled="!isEditing" />
              </div>
              <div>
                <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">{{ $t('pages.settings.model') }}</label>
                <input
                  v-model="config.api.embedding.model"
                  :disabled="!isEditing"
                  class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
              </div>
              <div>
                <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">{{ $t('pages.settings.api_key') }}</label>
                <input
                  v-model="config.api.embedding.apiKey"
                  type="password"
                  :disabled="!isEditing"
                  class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                >
              </div>
              <div>
                <label class="block text-sm text-gray-700 font-medium dark:text-gray-300">{{ $t('pages.settings.api_base_url') }}</label>
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
