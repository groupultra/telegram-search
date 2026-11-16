<script setup lang="ts">
import type { PublicClient } from '../../lib/server-auth'

import { useAccountStore } from '@tg-search/client'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import AuthCard from '../../components/auth/AuthCard.vue'

import { Button } from '../../components/ui/Button'
import { currentOAuthQuery, getPublicClientBeforeSignIn, safeRedirectPath } from '../../lib/server-auth'
import { useServerAuthStore } from '../../stores/server-auth'
import { LOGIN_DESKTOP_PRIMARY_BUTTON_CLASS } from '../login/styles'

defineOptions({ layout: false })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const accountStore = useAccountStore()
const serverAuth = useServerAuthStore()

// The authorization server redirects a client's request here with its signed query (`sig`).
const isAuthorizationRequest = computed(() => typeof route.query.sig === 'string' && typeof route.query.client_id === 'string')
const client = ref<PublicClient>()
const isLoading = ref(false)
const error = ref('')

async function continueSignIn() {
  isLoading.value = true
  error.value = ''
  try {
    const outcome = await serverAuth.completeSignIn(isAuthorizationRequest.value ? currentOAuthQuery() : undefined)
    if (outcome.kind === 'navigate')
      window.location.assign(outcome.url)
    else
      await router.replace(safeRedirectPath(route.query.redirect))
  }
  catch {
    error.value = t('serverAuth.signIn.failed')
    isLoading.value = false
  }
}

/**
 * Logging in to Telegram is the sign-in. `/login` returns here once the
 * account is ready (see App.vue), and this page finishes the sign-in with the
 * signed request still in its own URL.
 */
async function logInToTelegram() {
  await router.push({ path: '/login', query: { redirect: route.fullPath } })
}

onMounted(async () => {
  if (isAuthorizationRequest.value)
    client.value = await getPublicClientBeforeSignIn(route.query.client_id as string, currentOAuthQuery()).catch(() => undefined)
  if (accountStore.isReady)
    await continueSignIn()
})
</script>

<template>
  <AuthCard
    icon="i-lucide-search"
    :title="t('serverAuth.signIn.title')"
    :description="client ? t('serverAuth.signIn.continueTo', { client: client.name ?? client.clientId }) : t('serverAuth.signIn.description')"
  >
    <div class="space-y-6">
      <p v-if="error" role="alert" class="border border-destructive/30 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {{ error }}
      </p>
      <Button
        as="button"
        type="button"
        size="lg"
        :class="LOGIN_DESKTOP_PRIMARY_BUTTON_CLASS"
        :disabled="isLoading"
        @click="accountStore.isReady ? continueSignIn() : logInToTelegram()"
      >
        <span v-if="isLoading" class="i-lucide-loader-2 mr-2 animate-spin" />
        <span v-else class="i-lucide-send mr-2 h-5 w-5" />
        {{ isLoading ? t('login.processing') : accountStore.isReady ? t('serverAuth.signIn.continue') : t('serverAuth.signIn.withTelegram') }}
      </Button>
      <p class="text-center text-xs text-muted-foreground">
        {{ t('serverAuth.signIn.notice') }}
      </p>
    </div>
  </AuthCard>
</template>
