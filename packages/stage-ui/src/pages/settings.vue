<script setup lang="ts">
import { VAR_HUE } from '@proj-airi/unocss-preset-chromatic'
import { useBridgeStore, useSettingsStore } from '@tg-search/client'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import { Button } from '../components/ui/Button'
import ColorHueRange from '../components/ui/ColorHueRange.vue'
import SelectDropdown from '../components/ui/SelectDropdown.vue'
import { isCore } from '../lib/utils'

const { t } = useI18n()

const isEditing = ref(false)
const { config } = storeToRefs(useSettingsStore())
const websocketStore = useBridgeStore()

const DEFAULT_THEME_COLORS_HUE = 220.25
const themeColorsHue = ref<number>(DEFAULT_THEME_COLORS_HUE)
const primaryPreviewShades: readonly number[] = [200, 400, 500, 600, 700]
const complementaryPreviewShades: readonly number[] = [200, 400, 500, 600, 700]

let lastAppliedHue = DEFAULT_THEME_COLORS_HUE

function normalizeHue(value: number): number {
  if (!Number.isFinite(value))
    return DEFAULT_THEME_COLORS_HUE

  const wrappedHue = value % 360
  return wrappedHue < 0 ? wrappedHue + 360 : wrappedHue
}

function applyHueToDocument(hue: number) {
  if (hue === lastAppliedHue)
    return

  lastAppliedHue = hue
  document.documentElement.style.setProperty(VAR_HUE, hue.toFixed(2))
}

const embeddingProviderOptions = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Ollama', value: 'ollama' },
]

async function updateConfig() {
  if (!config.value)
    return

  websocketStore.sendEvent('config:update', { config: config.value })

  isEditing.value = false
  toast.success(t('settings.settingsSavedSuccessfully'))
}

onMounted(() => {
  const computedStyles = getComputedStyle(document.documentElement)
  const existingHue = Number.parseFloat(computedStyles.getPropertyValue(VAR_HUE))
  const resolvedHue = normalizeHue(existingHue)

  themeColorsHue.value = resolvedHue
  applyHueToDocument(resolvedHue)
  websocketStore.sendEvent('config:fetch')
})

watch(themeColorsHue, (hueCandidate) => {
  const normalizedHue = normalizeHue(hueCandidate)

  if (normalizedHue !== hueCandidate) {
    themeColorsHue.value = normalizedHue
    return
  }

  applyHueToDocument(normalizedHue)
})

const themeHueLabel = computed(() => themeColorsHue.value.toFixed(2))
</script>

<template>
  <header class="flex items-center border-b border-b-secondary p-4 px-4 dark:border-b-gray-700">
    <div class="flex items-center gap-2">
      <span class="text-lg font-medium text-foreground">{{ t('settings.settings') }}</span>
    </div>

    <div class="ml-auto flex items-center gap-2">
      <Button
        icon="i-lucide-pencil"
        :disabled="isEditing"
        @click="isEditing = !isEditing"
      >
        {{ t('settings.edit') }}
      </Button>

      <Button
        icon="i-lucide-save"
        :disabled="!isEditing"
        @click="updateConfig"
      >
        {{ t('settings.save') }}
      </Button>
    </div>
  </header>

  <div class="container mx-auto p-4 space-y-6">
    <!-- Settings form -->
    <div class="space-y-6">
      <!-- Database settings -->
      <div v-if="!isCore()" class="border border-neutral-200 rounded-lg bg-card p-4 dark:border-gray-600 dark:bg-gray-800">
        <h2 class="mb-4 text-xl text-gray-900 font-semibold dark:text-gray-100">
          {{ t('settings.databaseSettings') }}
        </h2>
        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="block text-sm text-gray-600 font-medium dark:text-gray-400">Host</label>
            <input
              v-model="config.database.host"
              type="text"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
          </div>
          <div>
            <label class="block text-sm text-gray-600 font-medium dark:text-gray-400">Port</label>
            <input
              v-model.number="config.database.port"
              type="number"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
          </div>
          <div>
            <label class="block text-sm text-gray-600 font-medium dark:text-gray-400">Username</label>
            <input
              v-model="config.database.user"
              type="text"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
          </div>
          <div>
            <label class="block text-sm text-gray-600 font-medium dark:text-gray-400">Password</label>
            <input
              v-model="config.database.password"
              type="password"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
          </div>
          <div class="md:col-span-2">
            <label class="block text-sm text-gray-600 font-medium dark:text-gray-400">Database Name</label>
            <input
              v-model="config.database.database"
              type="text"
              :disabled="!isEditing"
              class="mt-1 block w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
          </div>
        </div>
      </div>

      <div class="space-y-4 rounded-lg border border-border bg-card p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="space-y-1">
            <h2 class="text-xl font-semibold text-foreground">
              {{ t('theme.hue') }}
            </h2>
            <p class="text-sm text-muted-foreground">
              {{ t('theme.description') }}
            </p>
          </div>
          <span class="inline-flex min-w-[4.5rem] items-center justify-center rounded-lg bg-primary/20 px-3 py-1 font-mono text-sm text-primary">
            {{ themeHueLabel }}
          </span>
        </div>

        <ColorHueRange
          v-model="themeColorsHue"
          class="w-full"
          :disabled="!isEditing"
        />

        <div class="grid gap-4 md:grid-cols-2">
          <div class="space-y-2">
            <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {{ t('theme.primaryScale') }}
            </p>
            <div class="flex gap-2">
              <span
                v-for="shade in primaryPreviewShades"
                :key="`primary-${shade}`"
                class="h-10 flex-1 rounded-lg shadow-inner ring-1 ring-black/5 dark:ring-white/10"
                :class="[`bg-primary-${shade}`]"
                aria-hidden="true"
              />
            </div>
          </div>

          <div class="space-y-2">
            <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {{ t('theme.complementaryScale') }}
            </p>
            <div class="flex gap-2">
              <span
                v-for="shade in complementaryPreviewShades"
                :key="`complementary-${shade}`"
                class="h-10 flex-1 rounded-lg shadow-inner ring-1 ring-black/5 dark:ring-white/10"
                :class="[`bg-complementary-${shade}`]"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- API settings -->
      <div class="rounded-lg border border-border bg-card p-4">
        <h2 class="mb-4 text-xl font-semibold text-foreground">
          {{ t('settings.apiSettings') }}
        </h2>
        <div class="space-y-4">
          <!-- Telegram API -->
          <div>
            <h3 class="mb-2 text-lg font-medium text-foreground">
              {{ t('settings.telegramApi') }}
            </h3>
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <label class="block text-sm text-gray-600 font-medium dark:text-gray-400">API ID</label>
                <input
                  v-model="config.api.telegram.apiId"
                  type="text"
                  :disabled="!isEditing"
                  class="mt-1 block w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                >
              </div>
              <div>
                <label class="block text-sm text-gray-600 font-medium dark:text-gray-400">API Hash</label>
                <input
                  v-model="config.api.telegram.apiHash"
                  type="password"
                  :disabled="!isEditing"
                  class="mt-1 block w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                >
              </div>
            </div>
          </div>

          <!-- OpenAI API -->
          <div>
            <h3 class="mb-2 text-lg font-medium text-foreground">
              {{ t('settings.embedding') }}
            </h3>
            <div class="grid gap-4">
              <div>
                <label class="block text-sm text-gray-600 font-medium dark:text-gray-400">Provider</label>
                <SelectDropdown v-model="config.api.embedding.provider" :options="embeddingProviderOptions" :disabled="!isEditing" />
              </div>
              <div>
                <label class="block text-sm text-gray-600 font-medium dark:text-gray-400">{{ t('settings.model') }}</label>
                <input
                  v-model="config.api.embedding.model"
                  :disabled="!isEditing"
                  class="mt-1 block w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                >
              </div>
              <div>
                <label class="block text-sm text-gray-600 font-medium dark:text-gray-400">{{ t('settings.dimension') }}</label>
                <input
                  v-model="config.api.embedding.dimension"
                  :disabled="!isEditing"
                  class="mt-1 block w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                >
              </div>
              <div>
                <label class="block text-sm text-gray-600 font-medium dark:text-gray-400">{{ t('settings.apiKey') }}</label>
                <input
                  v-model="config.api.embedding.apiKey"
                  type="password"
                  :disabled="!isEditing"
                  class="mt-1 block w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                >
              </div>
              <div>
                <label class="block text-sm text-gray-600 font-medium dark:text-gray-400">{{ t('settings.apiBaseUrl') }}</label>
                <input
                  v-model="config.api.embedding.apiBase"
                  type="text"
                  :disabled="!isEditing"
                  class="mt-1 block w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                >
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
