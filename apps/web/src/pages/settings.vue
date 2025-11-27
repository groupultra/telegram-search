<script setup lang="ts">
import { useBridgeStore, useSettingsStore } from '@tg-search/client'
import { storeToRefs } from 'pinia'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import SelectDropdown from '../components/ui/SelectDropdown.vue'

import { Button } from '../components/ui/Button'

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
  <header class="flex items-center justify-between border-b bg-card/50 px-6 py-4 backdrop-blur-sm">
    <div class="flex items-center gap-3">
      <h1 class="text-lg font-semibold">
        {{ t('settings.settings') }}
      </h1>
    </div>

    <div class="flex items-center gap-2">
      <Button icon="i-lucide-save" @click="updateConfig">
        {{ t('settings.save') }}
      </Button>
    </div>
  </header>

  <div class="container mx-auto p-6 space-y-6">
    <!-- Settings form -->
    <div class="space-y-6">
      <!-- Database settings (hidden when VITE_WITH_CORE is enabled) -->
      <div v-if="!isWithCore" class="border rounded-lg bg-card p-6 shadow-sm">
        <h2 class="mb-4 text-xl font-semibold">
          {{ t('settings.databaseSettings') }}
        </h2>
        <div class="space-y-4">
          <div>
            <label class="block text-sm text-muted-foreground font-medium">Provider</label>
            <SelectDropdown
              v-model="config.database.type"
              :options="databaseProviderOptions"
            />
          </div>
          <div v-if="isPostgresSelected">
            <label class="block text-sm text-muted-foreground font-medium">Connection URL</label>
            <input
              v-model="config.database.url"
              type="password"
              placeholder="postgresql://user:password@host:port/database"
              class="mt-1 block w-full border rounded-md bg-background px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
            <p class="mt-1 text-xs text-muted-foreground">
              Optional: Use connection URL instead of individual fields below (default: <code>postgresql://user:password@host:port/database</code>)
            </p>
          </div>
          <div v-if="isPostgresSelected" class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="block text-sm text-muted-foreground font-medium">Host</label>
              <input
                v-model="config.database.host"
                type="text"
                :disabled="shouldDisableIndividualFields"
                class="mt-1 block w-full border rounded-md px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                :class="{
                  'cursor-not-allowed bg-muted opacity-60': shouldDisableIndividualFields,
                  'bg-background': !shouldDisableIndividualFields,
                }"
              >
            </div>
            <div>
              <label class="block text-sm text-muted-foreground font-medium">Port</label>
              <input
                v-model.number="config.database.port"
                type="number"
                :disabled="shouldDisableIndividualFields"
                class="mt-1 block w-full border rounded-md px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                :class="{
                  'cursor-not-allowed bg-muted opacity-60': shouldDisableIndividualFields,
                  'bg-background': !shouldDisableIndividualFields,
                }"
              >
            </div>
            <div>
              <label class="block text-sm text-muted-foreground font-medium">Username</label>
              <input
                v-model="config.database.user"
                type="text"
                :disabled="shouldDisableIndividualFields"
                class="mt-1 block w-full border rounded-md px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                :class="{
                  'cursor-not-allowed bg-muted opacity-60': shouldDisableIndividualFields,
                  'bg-background': !shouldDisableIndividualFields,
                }"
              >
            </div>
            <div>
              <label class="block text-sm text-muted-foreground font-medium">Password</label>
              <input
                v-model="config.database.password"
                type="password"
                :disabled="shouldDisableIndividualFields"
                class="mt-1 block w-full border rounded-md px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                :class="{
                  'cursor-not-allowed bg-muted opacity-60': shouldDisableIndividualFields,
                  'bg-background': !shouldDisableIndividualFields,
                }"
              >
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm text-muted-foreground font-medium">Database Name</label>
              <input
                v-model="config.database.database"
                type="text"
                :disabled="shouldDisableIndividualFields"
                class="mt-1 block w-full border rounded-md px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                :class="{
                  'cursor-not-allowed bg-muted opacity-60': shouldDisableIndividualFields,
                  'bg-background': !shouldDisableIndividualFields,
                }"
              >
            </div>
          </div>
        </div>
      </div>

      <!-- API settings -->
      <div class="border rounded-lg bg-card p-6 shadow-sm">
        <h2 class="mb-4 text-xl font-semibold">
          {{ t('settings.apiSettings') }}
        </h2>
        <div class="space-y-4">
          <!-- Telegram API -->
          <div>
            <h3 class="mb-2 text-lg font-medium">
              {{ t('settings.telegramApi') }}
            </h3>
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <label class="block text-sm text-muted-foreground font-medium">API ID</label>
                <input
                  v-model="config.api.telegram.apiId"
                  type="text"
                  class="mt-1 block w-full border rounded-md bg-background px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
              </div>
              <div>
                <label class="block text-sm text-muted-foreground font-medium">API Hash</label>
                <input
                  v-model="config.api.telegram.apiHash"
                  type="password"
                  class="mt-1 block w-full border rounded-md bg-background px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
              </div>
            </div>
          </div>

          <!-- OpenAI API -->
          <div>
            <h3 class="mb-2 text-lg font-medium">
              {{ t('settings.embedding') }}
            </h3>
            <div class="grid gap-4">
              <div>
                <label class="block text-sm text-muted-foreground font-medium">Provider</label>
                <SelectDropdown
                  v-model="config.api.embedding.provider"
                  :options="embeddingProviderOptions"
                />
              </div>
              <div>
                <label class="block text-sm text-muted-foreground font-medium">{{ t('settings.model') }}</label>
                <input
                  v-model="config.api.embedding.model"
                  class="mt-1 block w-full border rounded-md bg-background px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
              </div>
              <div>
                <label class="block text-sm text-muted-foreground font-medium">{{ t('settings.dimension') }}</label>
                <input
                  v-model="config.api.embedding.dimension"
                  class="mt-1 block w-full border rounded-md bg-background px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
              </div>
              <div>
                <label class="block text-sm text-muted-foreground font-medium">{{ t('settings.apiKey') }}</label>
                <input
                  v-model="config.api.embedding.apiKey"
                  type="password"
                  class="mt-1 block w-full border rounded-md bg-background px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
              </div>
              <div>
                <label class="block text-sm text-muted-foreground font-medium">{{ t('settings.apiBaseUrl') }}</label>
                <input
                  v-model="config.api.embedding.apiBase"
                  type="text"
                  class="mt-1 block w-full border rounded-md bg-background px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
              </div>
            </div>
          </div>

          <!-- LLM API -->
          <div>
            <h3 class="mb-2 text-lg font-medium">
              {{ t('settings.llm') }}
            </h3>
            <div class="grid gap-4">
              <div>
                <label class="block text-sm text-muted-foreground font-medium">{{ t('settings.llmProvider') }}</label>
                <input
                  v-model="config.api.llm.provider"
                  type="text"
                  placeholder="openai"
                  class="mt-1 block w-full border rounded-md bg-background px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
              </div>
              <div>
                <label class="block text-sm text-muted-foreground font-medium">{{ t('settings.llmModel') }}</label>
                <input
                  v-model="config.api.llm.model"
                  type="text"
                  placeholder="gpt-4o-mini"
                  class="mt-1 block w-full border rounded-md bg-background px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
              </div>
              <div>
                <label class="block text-sm text-muted-foreground font-medium">{{ t('settings.apiKey') }}</label>
                <input
                  v-model="config.api.llm.apiKey"
                  type="password"
                  class="mt-1 block w-full border rounded-md bg-background px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
              </div>
              <div>
                <label class="block text-sm text-muted-foreground font-medium">{{ t('settings.apiBaseUrl') }}</label>
                <input
                  v-model="config.api.llm.apiBase"
                  type="text"
                  placeholder="https://api.openai.com/v1"
                  class="mt-1 block w-full border rounded-md bg-background px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
              </div>
              <div class="grid gap-4 md:grid-cols-2">
                <div>
                  <label class="block text-sm text-muted-foreground font-medium">{{ t('settings.temperature') }}</label>
                  <input
                    v-model.number="config.api.llm.temperature"
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    class="mt-1 block w-full border rounded-md bg-background px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                </div>
                <div>
                  <label class="block text-sm text-muted-foreground font-medium">{{ t('settings.maxTokens') }}</label>
                  <input
                    v-model.number="config.api.llm.maxTokens"
                    type="number"
                    step="100"
                    min="100"
                    max="32000"
                    class="mt-1 block w-full border rounded-md bg-background px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Resolvers settings -->
      <div class="border rounded-lg bg-card p-6 shadow-sm">
        <h2 class="mb-4 text-xl font-semibold">
          {{ t('settings.resolversSettings') }}
        </h2>
        <div class="space-y-4">
          <p class="text-sm text-muted-foreground">
            {{ t('settings.resolversDescription') }}
          </p>
          <div class="grid gap-4 md:grid-cols-2">
            <div v-for="resolver in messageResolvers" :key="resolver.key" class="flex items-center justify-between">
              <label class="text-sm text-muted-foreground font-medium">
                {{ t(`settings.${resolver.key}Resolver`) }}
              </label>
              <label class="relative inline-flex cursor-pointer items-center">
                <input
                  :checked="isResolverEnabled(resolver.key)"
                  type="checkbox"
                  class="peer sr-only"
                  @change="toggleMessageResolver(resolver.key, ($event.target as HTMLInputElement).checked)"
                >
                <div class="peer h-6 w-11 rounded-full bg-muted after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:border after:rounded-full after:bg-background peer-checked:bg-primary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring after:transition-all after:content-[''] peer-checked:after:translate-x-full" />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
