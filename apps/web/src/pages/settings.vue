<script setup lang="ts">
import { useAccountStore, useBridge } from '@tg-search/client'
import { CoreEventType } from '@tg-search/core'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import AppearancePicker from '../components/appearance/AppearancePicker.vue'
import LanguagePicker from '../components/layout/LanguagePicker.vue'
import PageHeader from '../components/layout/PageHeader.vue'

import { Button } from '../components/ui/Button'
import { Switch } from '../components/ui/Switch'
import {
  buildDefaultMessageProcessing,
  createAccountSettingsSavePayload,
  ensureAccountSettingsDefaults,
  isMatchingAccountSettingsResponse,
} from '../utils/account-settings'

const { t } = useI18n()

const bridge = useBridge()
const accountStore = useAccountStore()
const { accountSettings, hasFetchedSettings, isReady } = storeToRefs(accountStore)
const isConfigLoaded = ref(false)
const isConfigLoading = ref(false)
const isConfigSaving = ref(false)
const hasConfigLoadFailed = ref(false)

const CONFIG_FETCH_ATTEMPTS = 4
const CONFIG_FETCH_TIMEOUT_MS = 2000

// Message resolvers configuration
const messageResolvers = [
  { key: 'media' },
  { key: 'user' },
  { key: 'link' },
  { key: 'embedding' },
]

const embeddingDimensions = Object.values([1536, 1024, 768])

function waitForFetchedSettings(timeout = CONFIG_FETCH_TIMEOUT_MS) {
  if (hasFetchedSettings.value && accountSettings.value) {
    return Promise.resolve(accountSettings.value)
  }

  return new Promise<NonNullable<typeof accountSettings.value>>((resolve, reject) => {
    const stop = watch(
      () => ({ fetched: hasFetchedSettings.value, settings: accountSettings.value }),
      ({ fetched, settings }) => {
        if (!fetched || !settings) {
          return
        }

        cleanup()
        resolve(settings)
      },
      { immediate: true },
    )

    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('settings fetch timeout'))
    }, timeout)

    function cleanup() {
      stop()
      window.clearTimeout(timer)
    }
  })
}

function waitForMatchingSavedSettings(timeout: number, expectedSettings: ReturnType<typeof createAccountSettingsSavePayload>) {
  return new Promise<NonNullable<typeof accountSettings.value>>((resolve, reject) => {
    const stop = watch(
      () => accountSettings.value,
      (settings) => {
        if (!settings || !isMatchingAccountSettingsResponse({ accountSettings: settings }, expectedSettings)) {
          return
        }

        cleanup()
        resolve(settings)
      },
    )

    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('settings save timeout'))
    }, timeout)

    function cleanup() {
      stop()
      window.clearTimeout(timer)
    }
  })
}

async function loadAccountSettings() {
  if (!isReady.value || isConfigLoading.value) {
    return
  }

  if (hasFetchedSettings.value && accountSettings.value) {
    isConfigLoaded.value = true
    return
  }

  isConfigLoading.value = true
  hasConfigLoadFailed.value = false

  try {
    let fetchedSettings: NonNullable<typeof accountSettings.value> | null = null

    for (let attempt = 1; attempt <= CONFIG_FETCH_ATTEMPTS; attempt += 1) {
      bridge.sendEvent(CoreEventType.ConfigFetch)

      try {
        fetchedSettings = await waitForFetchedSettings()
        break
      }
      catch {
        if (attempt === CONFIG_FETCH_ATTEMPTS) {
          throw new Error('settings fetch timeout')
        }
      }
    }

    if (!fetchedSettings) {
      throw new Error('settings fetch timeout')
    }

    isConfigLoaded.value = true
  }
  catch {
    isConfigLoaded.value = false
    hasConfigLoadFailed.value = true
    toast.error(t('settings.loadingSettingsFailed'))
  }
  finally {
    isConfigLoading.value = false
  }
}

watch(
  () => accountSettings.value,
  (settings) => {
    if (!settings) {
      return
    }

    ensureAccountSettingsDefaults(settings)
  },
  { immediate: true },
)

watch(
  () => isReady.value,
  (ready) => {
    if (!ready) {
      isConfigLoaded.value = false
      isConfigLoading.value = false
      hasConfigLoadFailed.value = false
      return
    }

    void loadAccountSettings()
  },
  { immediate: true },
)

watch(
  () => hasFetchedSettings.value,
  (fetched) => {
    if (fetched) {
      isConfigLoaded.value = true
      hasConfigLoadFailed.value = false
    }
  },
  { immediate: true },
)

const messageProcessing = computed(() => {
  return accountSettings.value?.messageProcessing ?? buildDefaultMessageProcessing()
})

// Computed properties for message resolver switches
const isResolverEnabled = computed(() => (resolverKey: string) => {
  const disabledResolvers = messageProcessing.value.resolvers.disabledResolvers
  if (!disabledResolvers)
    return true
  return !disabledResolvers.includes(resolverKey)
})

function toggleMessageResolver(resolverKey: string, enabled: boolean) {
  if (!accountSettings.value) {
    return
  }

  // Ensure messageProcessing and resolvers are initialized.
  const disabledResolvers = messageProcessing.value.resolvers.disabledResolvers
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
  if (!accountSettings.value || isConfigSaving.value)
    return

  isConfigSaving.value = true
  const toastId = toast.loading(t('settings.savingSettings'))
  const payload = createAccountSettingsSavePayload(accountSettings.value)

  try {
    const pendingSave = waitForMatchingSavedSettings(5000, payload)
    bridge.sendEvent(CoreEventType.ConfigUpdate, { accountSettings: payload })
    await pendingSave
    toast.success(t('settings.settingsSavedSuccessfully'), { id: toastId })
  }
  catch {
    toast.error(t('settings.settingsSaveFailed'), { id: toastId })
  }
  finally {
    isConfigSaving.value = false
  }
}
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden bg-background">
    <PageHeader :title="t('settings.settings')">
      <Button icon="i-lucide-save" size="sm" :disabled="!isConfigLoaded || isConfigLoading || isConfigSaving" @click="updateConfig">
        {{ t('settings.save') }}
      </Button>
    </PageHeader>

    <div class="flex-1 overflow-y-auto">
      <!-- Appearance: browser-local, so it is available before account settings load -->
      <div class="mx-auto max-w-3xl px-4 pt-6 md:px-6 md:pt-8">
        <section class="grid gap-4 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-10">
          <div>
            <h2 class="text-sm font-semibold tracking-tight">
              {{ t('appearance.title') }}
            </h2>
            <p class="mt-1 text-xs text-muted-foreground">
              {{ t('appearance.description') }}
            </p>
          </div>
          <div class="max-w-sm flex flex-col gap-4">
            <AppearancePicker />
            <LanguagePicker />
          </div>
        </section>
      </div>

      <div v-if="!isReady" class="mx-auto max-w-3xl px-4 py-6 md:px-6">
        <section class="border rounded-xl p-5 text-sm text-muted-foreground">
          <p class="text-foreground font-medium">
            {{ t('settings.waitingForConnection') }}
          </p>
        </section>
      </div>

      <div v-else-if="!isConfigLoaded" class="mx-auto max-w-3xl px-4 py-6 md:px-6">
        <section class="border rounded-xl p-5 space-y-4">
          <div class="space-y-1">
            <h2 class="text-base font-semibold">
              {{ t('settings.loadingSettings') }}
            </h2>
            <p class="text-sm text-muted-foreground">
              {{ hasConfigLoadFailed ? t('settings.loadingSettingsFailedDescription') : t('settings.loadingSettingsDescription') }}
            </p>
          </div>

          <div class="flex items-center gap-3">
            <div class="h-4 w-4 animate-spin border-2 border-foreground/20 border-t-foreground rounded-full" />
            <Button v-if="hasConfigLoadFailed" :disabled="isConfigLoading" variant="outline" @click="loadAccountSettings">
              {{ t('settings.retryLoadingSettings') }}
            </Button>
          </div>
        </section>
      </div>

      <div v-else class="mx-auto max-w-3xl px-4 pb-16 pt-6 space-y-6 md:px-6">
        <!-- API settings -->
        <section class="border-t pt-6 space-y-4">
          <div>
            <h2 class="text-sm font-semibold tracking-tight">
              {{ t('settings.apiSettings') }}
            </h2>
            <p class="mt-1 text-xs text-muted-foreground">
              Configure your AI models and API endpoints.
            </p>
          </div>

          <div class="grid gap-4">
            <!-- Embedding API -->
            <div class="border rounded-xl p-4 md:p-5">
              <div class="mb-5 flex items-center gap-3">
                <div class="h-8 w-8 flex shrink-0 items-center justify-center border rounded-lg text-foreground">
                  <span class="i-lucide-cpu h-4 w-4" />
                </div>
                <div>
                  <h3 class="text-sm font-medium leading-none">
                    {{ t('settings.embedding') }}
                  </h3>
                  <p class="mt-1 text-xs text-muted-foreground">
                    Vector embedding model for semantic search
                  </p>
                </div>
              </div>

              <div class="grid gap-4">
                <div class="grid gap-4 sm:grid-cols-2">
                  <div class="space-y-1.5">
                    <label class="text-xs text-muted-foreground font-medium">{{ t('settings.model') }}</label>
                    <input
                      v-model="accountSettings.embedding.model"
                      class="form-field"
                    >
                  </div>
                  <div class="space-y-1.5">
                    <label class="text-xs text-muted-foreground font-medium">{{ t('settings.dimension') }}</label>
                    <select
                      v-model="accountSettings.embedding.dimension"
                      class="form-field"
                    >
                      <option v-for="dimension in embeddingDimensions" :key="dimension" :value="dimension">
                        {{ dimension }}
                      </option>
                    </select>
                  </div>
                </div>

                <div class="grid gap-4 sm:grid-cols-2">
                  <div class="space-y-1.5">
                    <label class="text-xs text-muted-foreground font-medium">{{ t('settings.batchSize') }}</label>
                    <input
                      v-model="accountSettings.embedding.batchSize"
                      type="number"
                      step="1"
                      class="form-field"
                    >
                  </div>
                  <div class="space-y-1.5">
                    <label class="text-xs text-muted-foreground font-medium">{{ t('settings.apiBaseUrl') }}</label>
                    <input
                      v-model="accountSettings.embedding.apiBase"
                      type="text"
                      class="form-field"
                    >
                  </div>
                </div>

                <div class="space-y-1.5">
                  <label class="text-xs text-muted-foreground font-medium">{{ t('settings.apiKey') }}</label>
                  <input
                    v-model="accountSettings.embedding.apiKey"
                    type="password"
                    class="form-field"
                  >
                </div>
              </div>
            </div>

            <!-- LLM API -->
            <div class="border rounded-xl p-4 md:p-5">
              <div class="mb-5 flex items-center gap-3">
                <div class="h-8 w-8 flex shrink-0 items-center justify-center border rounded-lg text-foreground">
                  <span class="i-lucide-message-square-code h-4 w-4" />
                </div>
                <div>
                  <h3 class="text-sm font-medium leading-none">
                    {{ t('settings.llm') }}
                  </h3>
                  <p class="mt-1 text-xs text-muted-foreground">
                    Large Language Model for chat and reasoning
                  </p>
                </div>
              </div>

              <div class="grid gap-4">
                <div class="grid gap-4 sm:grid-cols-2">
                  <div class="space-y-1.5">
                    <label class="text-xs text-muted-foreground font-medium">{{ t('settings.llmModel') }}</label>
                    <input
                      v-model="accountSettings.llm.model"
                      type="text"
                      placeholder="gpt-4o-mini"
                      class="form-field"
                    >
                  </div>
                  <div class="space-y-1.5">
                    <label class="text-xs text-muted-foreground font-medium">{{ t('settings.apiBaseUrl') }}</label>
                    <input
                      v-model="accountSettings.llm.apiBase"
                      type="text"
                      placeholder="https://api.openai.com/v1"
                      class="form-field"
                    >
                  </div>
                </div>

                <div class="grid gap-4 sm:grid-cols-2">
                  <div class="space-y-1.5">
                    <label class="text-xs text-muted-foreground font-medium">{{ t('settings.temperature') }}</label>
                    <input
                      v-model.number="accountSettings.llm.temperature"
                      type="number"
                      step="0.1"
                      min="0"
                      max="2"
                      class="form-field"
                    >
                  </div>
                  <div class="space-y-1.5">
                    <label class="text-xs text-muted-foreground font-medium">{{ t('settings.maxTokens') }}</label>
                    <input
                      v-model.number="accountSettings.llm.maxTokens"
                      type="number"
                      step="100"
                      min="100"
                      max="32000"
                      class="form-field"
                    >
                  </div>
                </div>

                <div class="space-y-1.5">
                  <label class="text-xs text-muted-foreground font-medium">{{ t('settings.apiKey') }}</label>
                  <input
                    v-model="accountSettings.llm.apiKey"
                    type="password"
                    class="form-field"
                  >
                </div>
              </div>
            </div>

            <!-- Vision LLM Settings -->
            <div class="border rounded-xl p-4 md:p-5">
              <div class="mb-5 flex items-center gap-3">
                <div class="h-8 w-8 flex shrink-0 items-center justify-center border rounded-lg text-foreground">
                  <span class="i-lucide-eye h-4 w-4" />
                </div>
                <div>
                  <h3 class="text-sm font-medium leading-none">
                    {{ t('settings.visionLLM') }}
                  </h3>
                  <p class="mt-1 text-xs text-muted-foreground">
                    {{ t('settings.visionLLMDescription') }}
                  </p>
                </div>
              </div>

              <div class="grid gap-4">
                <div class="grid gap-4 sm:grid-cols-2">
                  <div class="space-y-1.5">
                    <label class="text-xs text-muted-foreground font-medium">{{ t('settings.model') }}</label>
                    <input
                      v-model="accountSettings.visionLLM.model"
                      type="text"
                      placeholder="qwen-vl-max"
                      class="form-field"
                    >
                  </div>
                  <div class="space-y-1.5">
                    <label class="text-xs text-muted-foreground font-medium">{{ t('settings.apiBaseUrl') }}</label>
                    <input
                      v-model="accountSettings.visionLLM.apiBase"
                      type="text"
                      placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
                      class="form-field"
                    >
                  </div>
                </div>

                <div class="grid gap-4 sm:grid-cols-2">
                  <div class="space-y-1.5">
                    <label class="text-xs text-muted-foreground font-medium">{{ t('settings.temperature') }}</label>
                    <input
                      v-model.number="accountSettings.visionLLM.temperature"
                      type="number"
                      step="0.1"
                      min="0"
                      max="2"
                      class="form-field"
                    >
                  </div>
                  <div class="space-y-1.5">
                    <label class="text-xs text-muted-foreground font-medium">{{ t('settings.maxTokens') }}</label>
                    <input
                      v-model.number="accountSettings.visionLLM.maxTokens"
                      type="number"
                      step="100"
                      min="100"
                      max="4000"
                      class="form-field"
                    >
                  </div>
                </div>

                <div class="space-y-1.5">
                  <label class="text-xs text-muted-foreground font-medium">{{ t('settings.apiKey') }}</label>
                  <input
                    v-model="accountSettings.visionLLM.apiKey"
                    type="password"
                    class="form-field"
                  >
                </div>
              </div>
            </div>

            <!-- Firecrawl link indexing settings -->
            <div class="border rounded-xl p-4 md:p-5">
              <div class="mb-5 flex items-center gap-3">
                <div class="h-8 w-8 flex shrink-0 items-center justify-center border rounded-lg text-foreground">
                  <span class="i-lucide-link h-4 w-4" />
                </div>
                <div>
                  <h3 class="text-sm font-medium leading-none">
                    {{ t('settings.firecrawl') }}
                  </h3>
                  <p class="mt-1 text-xs text-muted-foreground">
                    {{ t('settings.firecrawlDescription') }}
                  </p>
                </div>
              </div>

              <div class="grid gap-4 sm:grid-cols-2">
                <div class="space-y-1.5">
                  <label class="text-xs text-muted-foreground font-medium">{{ t('settings.apiBaseUrl') }}</label>
                  <input
                    v-model="accountSettings.firecrawl.apiBase"
                    type="text"
                    placeholder="https://api.firecrawl.dev"
                    class="form-field"
                  >
                </div>
                <div class="space-y-1.5">
                  <label class="text-xs text-muted-foreground font-medium">{{ t('settings.apiKey') }}</label>
                  <input
                    v-model="accountSettings.firecrawl.apiKey"
                    type="password"
                    placeholder="fc-..."
                    class="form-field"
                  >
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Message processing settings -->
        <section class="border-t pt-6 space-y-4">
          <div>
            <h2 class="text-sm font-semibold tracking-tight">
              {{ t('settings.messageProcessing') }}
            </h2>
            <p class="mt-1 text-xs text-muted-foreground">
              Customize how messages and media are handled.
            </p>
          </div>

          <div class="border rounded-xl p-4 md:p-5">
            <div class="space-y-5">
              <div class="grid gap-3 md:grid-cols-2">
                <div class="flex items-center justify-between gap-4 border rounded-lg p-3.5">
                  <div class="space-y-0.5">
                    <label class="text-sm font-medium">{{ t('settings.receiveAll') }}</label>
                    <p class="text-xs text-muted-foreground">
                      {{ t('settings.receiveMessagesDescription') }}
                    </p>
                  </div>
                  <Switch
                    :checked="messageProcessing.receiveMessages.receiveAll"
                    @update:checked="messageProcessing.receiveMessages.receiveAll = $event"
                  />
                </div>
                <div class="flex items-center justify-between gap-4 border rounded-lg p-3.5">
                  <div class="space-y-0.5">
                    <label class="text-sm font-medium">{{ t('settings.receiveMessagesDownloadMedia') }}</label>
                    <p class="text-xs text-muted-foreground">
                      Automatically download media files
                    </p>
                  </div>
                  <Switch
                    :checked="messageProcessing.receiveMessages.downloadMedia"
                    @update:checked="messageProcessing.receiveMessages.downloadMedia = $event"
                  />
                </div>
              </div>

              <div class="border-t pt-5">
                <div class="flex flex-col gap-4">
                  <div class="flex items-start justify-between gap-4">
                    <div class="min-w-0 flex-1 space-y-0.5">
                      <label class="break-words text-sm font-medium">{{ t('sync.syncMedia') }}</label>
                      <p class="break-all text-xs text-muted-foreground">
                        {{ t('sync.syncMediaDescription') }}
                      </p>
                    </div>
                    <Switch
                      v-model:checked="messageProcessing.defaults.syncMedia"
                    />
                  </div>

                  <div v-if="messageProcessing.defaults.syncMedia" class="flex animate-in items-center gap-4 border rounded-lg bg-muted/40 p-3.5 fade-in slide-in-from-top-2">
                    <div class="flex-1 space-y-1">
                      <label class="text-sm font-medium">{{ t('sync.maxMediaSize') }}</label>
                      <p class="text-xs text-muted-foreground">
                        {{ t('sync.maxMediaSizeDescription') }}
                      </p>
                    </div>
                    <div class="flex items-center gap-2">
                      <input
                        v-model.number="messageProcessing.defaults.maxMediaSize"
                        type="number"
                        min="0"
                        step="1"
                        class="form-field w-24!"
                        placeholder="0"
                      >
                      <span class="text-sm text-muted-foreground">MB</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="border-t pt-5">
                <div class="mb-4 space-y-1">
                  <h3 class="text-sm font-medium">
                    Message Resolvers
                  </h3>
                  <p class="text-xs text-muted-foreground">
                    {{ t('settings.resolversDescription') }}
                  </p>
                </div>
                <div class="grid gap-3 md:grid-cols-2">
                  <div
                    v-for="resolver in messageResolvers"
                    :key="resolver.key"
                    class="flex items-center justify-between gap-4 border rounded-lg p-3.5"
                  >
                    <div class="min-w-0 flex flex-1 flex-col gap-1">
                      <span class="break-words text-sm font-medium">{{ t(`settings.resolvers.${resolver.key}`) }}</span>
                      <span class="break-all text-xs text-muted-foreground">{{ t(`settings.resolvers.${resolver.key}Description`) }}</span>
                    </div>
                    <Switch
                      :checked="isResolverEnabled(resolver.key)"
                      @update:checked="(checked: boolean) => toggleMessageResolver(resolver.key, checked)"
                    />
                  </div>
                </div>
              </div>

              <div class="border-t pt-5">
                <div class="flex items-start justify-between gap-4">
                  <div class="min-w-0 flex-1 space-y-0.5">
                    <label class="break-words text-sm font-medium">{{ t('settings.enablePhotoEmbedding') }}</label>
                    <p class="break-all text-xs text-muted-foreground">
                      {{ t('settings.enablePhotoEmbeddingDescription') }}
                    </p>
                  </div>
                  <Switch
                    v-model:checked="messageProcessing.enablePhotoEmbedding"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
