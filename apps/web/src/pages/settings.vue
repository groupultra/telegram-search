<script setup lang="ts">
import { useAccountStore, useBridgeStore } from '@tg-search/client'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

import { Button } from '../components/ui/Button'

const { t } = useI18n()

const { accountSettings } = storeToRefs(useAccountStore())

// Message resolvers configuration
const messageResolvers = [
  { key: 'media' },
  { key: 'user' },
  { key: 'link' },
  { key: 'embedding' },
]

const embeddingDimensions = Object.values([1536, 1024, 768])

// Computed properties for message resolver switches
const isResolverEnabled = computed(() => (resolverKey: string) => {
  if (!accountSettings.value?.resolvers?.disabledResolvers)
    return true
  return !accountSettings.value.resolvers.disabledResolvers.includes(resolverKey)
})

function toggleMessageResolver(resolverKey: string, enabled: boolean) {
  if (!accountSettings.value) {
    return
  }

  // Ensure resolvers and disabledResolvers are initialized.
  accountSettings.value.resolvers ??= { disabledResolvers: [] }
  accountSettings.value.resolvers.disabledResolvers ??= []

  const disabledResolvers = accountSettings.value.resolvers.disabledResolvers
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

function updateConfig() {
  if (!accountSettings.value)
    return

  useBridgeStore().sendEvent('config:update', { accountSettings: accountSettings.value })
  const toastId = toast.loading(t('settings.savingSettings'))

  Promise.race([
    useBridgeStore().waitForEvent('config:data'),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000)),
  ])
    .then(() => toast.success(t('settings.settingsSavedSuccessfully'), { id: toastId }))
    .catch((error) => {
      toast.error(error.message, { id: toastId })
    })
}
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
      <!-- API settings -->
      <div class="border rounded-lg bg-card p-6 shadow-sm">
        <h2 class="mb-4 text-xl font-semibold">
          {{ t('settings.apiSettings') }}
        </h2>
        <div class="space-y-4">
          <!-- OpenAI API -->
          <div>
            <h3 class="mb-2 text-lg font-medium">
              {{ t('settings.embedding') }}
            </h3>
            <div class="grid gap-4">
              <div>
                <label class="block text-sm text-muted-foreground font-medium">{{ t('settings.model') }}</label>
                <input
                  v-model="accountSettings.embedding.model"
                  class="mt-1 block w-full border rounded-md bg-background px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
              </div>
              <div>
                <label class="block text-sm text-muted-foreground font-medium">{{ t('settings.dimension') }}</label>
                <select
                  v-model="accountSettings.embedding.dimension"
                  class="mt-1 block w-full border rounded-md bg-background px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option v-for="dimension in embeddingDimensions" :key="dimension" :value="dimension">
                    {{ dimension }}
                  </option>
                </select>
              </div>
              <div>
                <label class="block text-sm text-muted-foreground font-medium">{{ t('settings.apiKey') }}</label>
                <input
                  v-model="accountSettings.embedding.apiKey"
                  type="password"
                  class="mt-1 block w-full border rounded-md bg-background px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
              </div>
              <div>
                <label class="block text-sm text-muted-foreground font-medium">{{ t('settings.apiBaseUrl') }}</label>
                <input
                  v-model="accountSettings.embedding.apiBase"
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
                <label class="block text-sm text-muted-foreground font-medium">{{ t('settings.llmModel') }}</label>
                <input
                  v-model="accountSettings.llm.model"
                  type="text"
                  placeholder="gpt-4o-mini"
                  class="mt-1 block w-full border rounded-md bg-background px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
              </div>
              <div>
                <label class="block text-sm text-muted-foreground font-medium">{{ t('settings.apiKey') }}</label>
                <input
                  v-model="accountSettings.llm.apiKey"
                  type="password"
                  class="mt-1 block w-full border rounded-md bg-background px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
              </div>
              <div>
                <label class="block text-sm text-muted-foreground font-medium">{{ t('settings.apiBaseUrl') }}</label>
                <input
                  v-model="accountSettings.llm.apiBase"
                  type="text"
                  placeholder="https://api.openai.com/v1"
                  class="mt-1 block w-full border rounded-md bg-background px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
              </div>
              <div class="grid gap-4 md:grid-cols-2">
                <div>
                  <label class="block text-sm text-muted-foreground font-medium">{{ t('settings.temperature') }}</label>
                  <input
                    v-model.number="accountSettings.llm.temperature"
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
                    v-model.number="accountSettings.llm.maxTokens"
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

      <!-- Receive messages settings -->
      <div
        v-if="accountSettings.receiveMessages"
        class="border rounded-lg bg-card p-6 shadow-sm"
      >
        <h2 class="mb-4 text-xl font-semibold">
          {{ t('settings.receiveMessagesSettings') }}
        </h2>
        <div class="space-y-4">
          <p class="text-sm text-muted-foreground">
            {{ t('settings.receiveMessagesDescription') }}
          </p>
          <div class="grid gap-4 md:grid-cols-2">
            <div class="flex items-center justify-between">
              <label class="text-sm text-muted-foreground font-medium">
                {{ t('settings.receiveAll') }}
              </label>
              <label class="relative inline-flex cursor-pointer items-center">
                <input
                  :checked="accountSettings.receiveMessages.receiveAll"
                  type="checkbox"
                  class="peer sr-only"
                  @change="accountSettings.receiveMessages.receiveAll = ($event.target as HTMLInputElement).checked"
                >
                <div class="peer h-6 w-11 rounded-full bg-muted after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:border after:rounded-full after:bg-background peer-checked:bg-primary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring after:transition-all after:content-[''] peer-checked:after:translate-x-full" />
              </label>
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
