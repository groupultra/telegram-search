<script setup lang="ts">
import { useBridgeStore, useSettingsStore } from '@tg-search/client'
import { storeToRefs } from 'pinia'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import { Button } from '../components/ui/Button'
import SelectDropdown from '../components/ui/SelectDropdown.vue'

const { t } = useI18n()

const { config } = storeToRefs(useSettingsStore())
const websocketStore = useBridgeStore()

const embeddingProviderOptions = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Ollama', value: 'ollama' },
]

const databaseProviderOptions = [
  { label: 'PostgreSQL', value: 'postgres' },
  { label: 'PGLite', value: 'pglite' },
]

// Check if VITE_WITH_CORE is enabled
const isWithCore = import.meta.env.VITE_WITH_CORE === 'true'

// Computed properties for dynamic form behavior
const isPostgresSelected = computed(() => config.value?.database?.type === 'postgres')
const hasConnectionUrl = computed(() => !!config.value?.database?.url?.trim())
const shouldDisableIndividualFields = computed(() => isPostgresSelected.value && hasConnectionUrl.value)

// Message resolvers configuration
const messageResolvers = [
  { key: 'media' },
  { key: 'user' },
  { key: 'link' },
  { key: 'embedding' },
  { key: 'jieba' },
]

// Computed properties for message resolver switches
const isResolverEnabled = computed(() => (resolverKey: string) => {
  if (!config.value?.resolvers?.disabledResolvers)
    return true
  return !config.value.resolvers.disabledResolvers.includes(resolverKey)
})

function toggleMessageResolver(resolverKey: string, enabled: boolean) {
  if (!config.value) {
    return
  }

  // Ensure resolvers and disabledResolvers are initialized.
  config.value.resolvers ??= { disabledResolvers: [] }
  config.value.resolvers.disabledResolvers ??= []

  const disabledResolvers = config.value.resolvers.disabledResolvers
  const index = disabledResolvers.indexOf(resolverKey)

  if (enabled && index !== -1) {
    // Enable resolver - remove from disabled list
    disabledResolvers.splice(index, 1)
  }
  else if (!enabled && index === -1) {
    // Disable resolver - add to disabled list
    disabledResolvers.push(resolverKey)
  }
}

async function updateConfig() {
  if (!config.value)
    return

  websocketStore.sendEvent('config:update', { config: config.value })

  toast.success(t('settings.settingsSavedSuccessfully'))
}

onMounted(() => {
  websocketStore.sendEvent('config:fetch')
})
</script>

<template>
  <header class="flex items-center border-b border-b-secondary p-4 px-4 dark:border-b-gray-700">
    <div class="flex items-center gap-2">
      <span class="text-lg text-gray-900 font-medium dark:text-gray-100">{{ t('settings.settings') }}</span>
    </div>

    <div class="ml-auto flex items-center gap-2">
      <Button icon="i-lucide-save" @click="updateConfig">
        {{ t('settings.save') }}
      </Button>
    </div>
  </header>

  <div class="container mx-auto p-4 space-y-6">
    <!-- Settings form -->
    <div class="space-y-6">
      <!-- Database settings (hidden when VITE_WITH_CORE is enabled) -->
      <div v-if="!isWithCore" class="border border-neutral-200 rounded-lg bg-card p-4 dark:border-gray-600 dark:bg-gray-800">
        <h2 class="mb-4 text-xl text-gray-900 font-semibold dark:text-gray-100">
          {{ t('settings.databaseSettings') }}
        </h2>
        <div class="space-y-4">
          <div>
            <label class="block text-sm text-gray-600 font-medium dark:text-gray-400">Provider</label>
            <SelectDropdown
              v-model="config.database.type"
              :options="databaseProviderOptions"
            />
          </div>
          <div v-if="isPostgresSelected">
            <label class="block text-sm text-gray-600 font-medium dark:text-gray-400">Connection URL</label>
            <input
              v-model="config.database.url"
              type="text"
              placeholder="postgresql://user:password@host:port/database"
              class="mt-1 block w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Optional: Use connection URL instead of individual fields below
            </p>
          </div>
          <div v-if="isPostgresSelected" class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="block text-sm text-gray-600 font-medium dark:text-gray-400">Host</label>
              <input
                v-model="config.database.host"
                type="text"
                :disabled="shouldDisableIndividualFields"
                class="mt-1 block w-full border border-neutral-200 rounded-md px-3 py-2 text-gray-900 dark:border-gray-600 dark:text-gray-100"
                :class="{
                  'bg-gray-200 dark:bg-gray-600 cursor-not-allowed opacity-60': shouldDisableIndividualFields,
                  'bg-neutral-100 dark:bg-gray-700': !shouldDisableIndividualFields,
                }"
              >
            </div>
            <div>
              <label class="block text-sm text-gray-600 font-medium dark:text-gray-400">Port</label>
              <input
                v-model.number="config.database.port"
                type="number"
                :disabled="shouldDisableIndividualFields"
                class="mt-1 block w-full border border-neutral-200 rounded-md px-3 py-2 text-gray-900 dark:border-gray-600 dark:text-gray-100"
                :class="{
                  'bg-gray-200 dark:bg-gray-600 cursor-not-allowed opacity-60': shouldDisableIndividualFields,
                  'bg-neutral-100 dark:bg-gray-700': !shouldDisableIndividualFields,
                }"
              >
            </div>
            <div>
              <label class="block text-sm text-gray-600 font-medium dark:text-gray-400">Username</label>
              <input
                v-model="config.database.user"
                type="text"
                :disabled="shouldDisableIndividualFields"
                class="mt-1 block w-full border border-neutral-200 rounded-md px-3 py-2 text-gray-900 dark:border-gray-600 dark:text-gray-100"
                :class="{
                  'bg-gray-200 dark:bg-gray-600 cursor-not-allowed opacity-60': shouldDisableIndividualFields,
                  'bg-neutral-100 dark:bg-gray-700': !shouldDisableIndividualFields,
                }"
              >
            </div>
            <div>
              <label class="block text-sm text-gray-600 font-medium dark:text-gray-400">Password</label>
              <input
                v-model="config.database.password"
                type="password"
                :disabled="shouldDisableIndividualFields"
                class="mt-1 block w-full border border-neutral-200 rounded-md px-3 py-2 text-gray-900 dark:border-gray-600 dark:text-gray-100"
                :class="{
                  'bg-gray-200 dark:bg-gray-600 cursor-not-allowed opacity-60': shouldDisableIndividualFields,
                  'bg-neutral-100 dark:bg-gray-700': !shouldDisableIndividualFields,
                }"
              >
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm text-gray-600 font-medium dark:text-gray-400">Database Name</label>
              <input
                v-model="config.database.database"
                type="text"
                :disabled="shouldDisableIndividualFields"
                class="mt-1 block w-full border border-neutral-200 rounded-md px-3 py-2 text-gray-900 dark:border-gray-600 dark:text-gray-100"
                :class="{
                  'bg-gray-200 dark:bg-gray-600 cursor-not-allowed opacity-60': shouldDisableIndividualFields,
                  'bg-neutral-100 dark:bg-gray-700': !shouldDisableIndividualFields,
                }"
              >
            </div>
          </div>
        </div>
      </div>

      <!-- API settings -->
      <div class="border border-neutral-200 rounded-lg bg-card p-4 dark:border-gray-600 dark:bg-gray-800">
        <h2 class="mb-4 text-xl text-gray-900 font-semibold dark:text-gray-100">
          {{ t('settings.apiSettings') }}
        </h2>
        <div class="space-y-4">
          <!-- Telegram API -->
          <div>
            <h3 class="mb-2 text-lg text-gray-900 font-medium dark:text-gray-100">
              {{ t('settings.telegramApi') }}
            </h3>
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <label class="block text-sm text-gray-600 font-medium dark:text-gray-400">API ID</label>
                <input
                  v-model="config.api.telegram.apiId"
                  type="text"
                  class="mt-1 block w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                >
              </div>
              <div>
                <label class="block text-sm text-gray-600 font-medium dark:text-gray-400">API Hash</label>
                <input
                  v-model="config.api.telegram.apiHash"
                  type="password"
                  class="mt-1 block w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                >
              </div>
            </div>
          </div>

          <!-- OpenAI API -->
          <div>
            <h3 class="mb-2 text-lg text-gray-900 font-medium dark:text-gray-100">
              {{ t('settings.embedding') }}
            </h3>
            <div class="grid gap-4">
              <div>
                <label class="block text-sm text-gray-600 font-medium dark:text-gray-400">Provider</label>
                <SelectDropdown
                  v-model="config.api.embedding.provider"
                  :options="embeddingProviderOptions"
                />
              </div>
              <div>
                <label class="block text-sm text-gray-600 font-medium dark:text-gray-400">{{ t('settings.model') }}</label>
                <input
                  v-model="config.api.embedding.model"
                  class="mt-1 block w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                >
              </div>
              <div>
                <label class="block text-sm text-gray-600 font-medium dark:text-gray-400">{{ t('settings.dimension') }}</label>
                <input
                  v-model="config.api.embedding.dimension"
                  class="mt-1 block w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                >
              </div>
              <div>
                <label class="block text-sm text-gray-600 font-medium dark:text-gray-400">{{ t('settings.apiKey') }}</label>
                <input
                  v-model="config.api.embedding.apiKey"
                  type="password"
                  class="mt-1 block w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                >
              </div>
              <div>
                <label class="block text-sm text-gray-600 font-medium dark:text-gray-400">{{ t('settings.apiBaseUrl') }}</label>
                <input
                  v-model="config.api.embedding.apiBase"
                  type="text"
                  class="mt-1 block w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                >
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Resolvers settings -->
      <div class="border border-neutral-200 rounded-lg bg-card p-4 dark:border-gray-600 dark:bg-gray-800">
        <h2 class="mb-4 text-xl text-gray-900 font-semibold dark:text-gray-100">
          {{ t('settings.resolversSettings') }}
        </h2>
        <div class="space-y-4">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ t('settings.resolversDescription') }}
          </p>
          <div class="grid gap-4 md:grid-cols-2">
            <div v-for="resolver in messageResolvers" :key="resolver.key" class="flex items-center justify-between">
              <label class="text-sm text-gray-600 font-medium dark:text-gray-400">
                {{ t(`settings.${resolver.key}Resolver`) }}
              </label>
              <label class="relative inline-flex cursor-pointer items-center">
                <input
                  :checked="isResolverEnabled(resolver.key)"
                  type="checkbox"
                  class="peer sr-only"
                  @change="toggleMessageResolver(resolver.key, ($event.target as HTMLInputElement).checked)"
                >
                <div class="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:border after:border-gray-300 dark:border-gray-600 after:rounded-full after:bg-white dark:bg-gray-700 peer-checked:bg-blue-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white dark:peer-focus:ring-blue-800" />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
