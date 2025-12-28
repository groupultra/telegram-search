<script setup lang="ts">
import { useAccountStore } from '@tg-search/client'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import { Button } from '../ui/Button'

const { t } = useI18n()
const route = useRoute()
const accountStore = useAccountStore()
const { auth } = storeToRefs(accountStore)
</script>

<template>
  <div class="flex items-center justify-center px-6 py-8">
    <div
      class="max-w-2xl w-full border border-primary/20 rounded-2xl bg-primary/5 p-6 transition-all"
    >
      <div class="flex flex-col items-center justify-center gap-4 md:flex-row md:justify-between">
        <div class="flex items-center gap-4">
          <div class="h-12 w-12 flex shrink-0 items-center justify-center rounded-full bg-primary/10">
            <div
              v-if="auth.isLoading"
              class="i-lucide-loader-2 h-6 w-6 animate-spin text-primary"
            />
            <div
              v-else
              class="i-lucide-lock-keyhole h-6 w-6 text-primary"
            />
          </div>
          <div v-if="auth.isLoading" class="flex flex-col gap-1">
            <span class="text-sm text-foreground font-semibold">
              {{ t('loginPromptBanner.loggingIn') }}
            </span>
            <span class="text-xs text-muted-foreground">
              {{ t('loginPromptBanner.loggingInSubtitle') }}
            </span>
          </div>

          <div v-else-if="!auth.needCode && !auth.needPassword" class="flex flex-col gap-1">
            <span class="text-sm text-foreground font-semibold">
              {{ t('loginPromptBanner.pleaseLoginToUseFullFeatures') }}
            </span>
            <span class="text-xs text-muted-foreground">
              {{ t('loginPromptBanner.subtitle') }}
            </span>
          </div>
        </div>
        <Button
          v-if="!auth.isLoading"
          size="md"
          icon="i-lucide-log-in"
          class="shrink-0"
          @click="$router.push({ path: '/login', query: { redirect: route.fullPath } })"
        >
          {{ t('loginPromptBanner.login') }}
        </Button>
      </div>
    </div>
  </div>
</template>
