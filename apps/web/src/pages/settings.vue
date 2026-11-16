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
import SettingsGroup from '../components/layout/SettingsGroup.vue'

import { Button } from '../components/ui/Button'
import { FormItem } from '../components/ui/FormItem'
import { Input } from '../components/ui/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select'
import { Spinner } from '../components/ui/Spinner'
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
  <div class="h-full flex flex-col overflow-hidden bg-layout">
    <PageHeader :title="t('settings.settings')">
      <Button variant="primary" icon="i-lucide-save" :disabled="!isConfigLoaded || isConfigLoading || isConfigSaving" @click="updateConfig">
        {{ t('settings.save') }}
      </Button>
    </PageHeader>

    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto max-w-2xl flex flex-col gap-8 px-4 pb-16 pt-6">
        <!-- Appearance: browser-local, so it is available before account settings load -->
        <SettingsGroup :title="t('appearance.title')" :description="t('appearance.description')" icon="i-lucide-palette">
          <AppearancePicker />
          <LanguagePicker />
        </SettingsGroup>

        <SettingsGroup v-if="!isReady" :title="t('settings.waitingForConnection')" icon="i-lucide-plug">
          <Spinner />
        </SettingsGroup>

        <SettingsGroup
          v-else-if="!isConfigLoaded"
          :title="t('settings.loadingSettings')"
          :description="hasConfigLoadFailed ? t('settings.loadingSettingsFailedDescription') : t('settings.loadingSettingsDescription')"
          icon="i-lucide-cloud-download"
        >
          <div class="flex items-center gap-3">
            <Spinner />
            <Button v-if="hasConfigLoadFailed" :disabled="isConfigLoading" @click="loadAccountSettings">
              {{ t('settings.retryLoadingSettings') }}
            </Button>
          </div>
        </SettingsGroup>

        <template v-else>
          <!-- API settings -->
          <!-- Embedding API -->
          <SettingsGroup :title="t('settings.embedding')" description="Vector embedding model for semantic search" icon="i-lucide-cpu">
            <div class="grid gap-4 sm:grid-cols-2">
              <FormItem :label="t('settings.model')">
                <Input v-model="accountSettings.embedding.model" />
              </FormItem>
              <FormItem :label="t('settings.dimension')">
                <Select v-model="accountSettings.embedding.dimension">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="dimension in embeddingDimensions" :key="dimension" :value="dimension">
                      {{ dimension }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <FormItem :label="t('settings.batchSize')">
                <Input v-model="accountSettings.embedding.batchSize" type="number" step="1" />
              </FormItem>
              <FormItem :label="t('settings.apiBaseUrl')">
                <Input v-model="accountSettings.embedding.apiBase" type="text" />
              </FormItem>
            </div>
            <FormItem :label="t('settings.apiKey')">
              <Input v-model="accountSettings.embedding.apiKey" type="password" />
            </FormItem>
          </SettingsGroup>

          <!-- LLM API -->
          <SettingsGroup :title="t('settings.llm')" description="Large Language Model for chat and reasoning" icon="i-lucide-message-square-code">
            <div class="grid gap-4 sm:grid-cols-2">
              <FormItem :label="t('settings.llmModel')">
                <Input v-model="accountSettings.llm.model" type="text" placeholder="gpt-4o-mini" />
              </FormItem>
              <FormItem :label="t('settings.apiBaseUrl')">
                <Input v-model="accountSettings.llm.apiBase" type="text" placeholder="https://api.openai.com/v1" />
              </FormItem>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <FormItem :label="t('settings.temperature')">
                <Input v-model.number="accountSettings.llm.temperature" type="number" step="0.1" min="0" max="2" />
              </FormItem>
              <FormItem :label="t('settings.maxTokens')">
                <Input v-model.number="accountSettings.llm.maxTokens" type="number" step="100" min="100" max="32000" />
              </FormItem>
            </div>
            <FormItem :label="t('settings.apiKey')">
              <Input v-model="accountSettings.llm.apiKey" type="password" />
            </FormItem>
          </SettingsGroup>

          <!-- Vision LLM Settings -->
          <SettingsGroup :title="t('settings.visionLLM')" :description="t('settings.visionLLMDescription')" icon="i-lucide-eye">
            <div class="grid gap-4 sm:grid-cols-2">
              <FormItem :label="t('settings.model')">
                <Input v-model="accountSettings.visionLLM.model" type="text" placeholder="qwen-vl-max" />
              </FormItem>
              <FormItem :label="t('settings.apiBaseUrl')">
                <Input v-model="accountSettings.visionLLM.apiBase" type="text" placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1" />
              </FormItem>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <FormItem :label="t('settings.temperature')">
                <Input v-model.number="accountSettings.visionLLM.temperature" type="number" step="0.1" min="0" max="2" />
              </FormItem>
              <FormItem :label="t('settings.maxTokens')">
                <Input v-model.number="accountSettings.visionLLM.maxTokens" type="number" step="100" min="100" max="4000" />
              </FormItem>
            </div>
            <FormItem :label="t('settings.apiKey')">
              <Input v-model="accountSettings.visionLLM.apiKey" type="password" />
            </FormItem>
          </SettingsGroup>

          <!-- Firecrawl link indexing settings -->
          <SettingsGroup :title="t('settings.firecrawl')" :description="t('settings.firecrawlDescription')" icon="i-lucide-link">
            <div class="grid gap-4 sm:grid-cols-2">
              <FormItem :label="t('settings.apiBaseUrl')">
                <Input v-model="accountSettings.firecrawl.apiBase" type="text" placeholder="https://api.firecrawl.dev" />
              </FormItem>
              <FormItem :label="t('settings.apiKey')">
                <Input v-model="accountSettings.firecrawl.apiKey" type="password" placeholder="fc-..." />
              </FormItem>
            </div>
          </SettingsGroup>

          <!-- Message processing settings -->
          <SettingsGroup :title="t('settings.messageProcessing')" description="Customize how messages and media are handled." icon="i-lucide-workflow">
            <FormItem :label="t('settings.receiveAll')" :description="t('settings.receiveMessagesDescription')" layout="horizontal">
              <Switch
                :checked="messageProcessing.receiveMessages.receiveAll"
                @update:checked="messageProcessing.receiveMessages.receiveAll = $event"
              />
            </FormItem>
            <FormItem :label="t('settings.receiveMessagesDownloadMedia')" description="Automatically download media files" layout="horizontal">
              <Switch
                :checked="messageProcessing.receiveMessages.downloadMedia"
                @update:checked="messageProcessing.receiveMessages.downloadMedia = $event"
              />
            </FormItem>

            <div class="h-px bg-line-2" />

            <FormItem :label="t('sync.syncMedia')" :description="t('sync.syncMediaDescription')" layout="horizontal">
              <Switch v-model:checked="messageProcessing.defaults.syncMedia" />
            </FormItem>
            <FormItem
              v-if="messageProcessing.defaults.syncMedia"
              :label="t('sync.maxMediaSize')"
              :description="t('sync.maxMediaSizeDescription')"
              layout="horizontal"
            >
              <Input
                v-model.number="messageProcessing.defaults.maxMediaSize"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                class="w-28"
              >
                <template #suffix>
                  <span class="text-xs text-fg-3">MB</span>
                </template>
              </Input>
            </FormItem>

            <div class="h-px bg-line-2" />

            <FormItem :label="t('settings.enablePhotoEmbedding')" :description="t('settings.enablePhotoEmbeddingDescription')" layout="horizontal">
              <Switch v-model:checked="messageProcessing.enablePhotoEmbedding" />
            </FormItem>
          </SettingsGroup>

          <SettingsGroup title="Message Resolvers" :description="t('settings.resolversDescription')" icon="i-lucide-blocks">
            <FormItem
              v-for="resolver in messageResolvers"
              :key="resolver.key"
              :label="t(`settings.resolvers.${resolver.key}`)"
              :description="t(`settings.resolvers.${resolver.key}Description`)"
              layout="horizontal"
            >
              <Switch
                :checked="isResolverEnabled(resolver.key)"
                @update:checked="(checked: boolean) => toggleMessageResolver(resolver.key, checked)"
              />
            </FormItem>
          </SettingsGroup>
        </template>
      </div>
    </div>
  </div>
</template>
