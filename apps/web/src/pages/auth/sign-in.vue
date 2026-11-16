<script setup lang="ts">
import type { PublicClient } from '../../lib/server-auth'

import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import AuthCard from '../../components/auth/AuthCard.vue'

import { Button } from '../../components/ui/Button'
import { currentOAuthQuery, getPublicClientBeforeSignIn, getServerAuthStatus, safeRedirectPath, startTelegramSignIn } from '../../lib/server-auth'
import { LOGIN_DESKTOP_PRIMARY_BUTTON_CLASS } from '../login/styles'

defineOptions({ layout: false })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

// The server redirects an authorization request here with its signed query (`sig`).
const isAuthorizationRequest = computed(() => typeof route.query.sig === 'string' && typeof route.query.client_id === 'string')
const client = ref<PublicClient>()
const isLoading = ref(false)
const error = ref(typeof route.query.error === 'string' ? t('serverAuth.signIn.failed') : '')

onMounted(async () => {
  if (isAuthorizationRequest.value) {
    client.value = await getPublicClientBeforeSignIn(route.query.client_id as string, currentOAuthQuery()).catch(() => undefined)
    return
  }
  // A signed-in user who opens this page directly continues where they were going.
  if (await getServerAuthStatus().catch(() => undefined) === 'signed-in')
    await router.replace(safeRedirectPath(route.query.redirect))
})

async function signIn() {
  isLoading.value = true
  error.value = ''
  try {
    const url = await startTelegramSignIn(isAuthorizationRequest.value
      ? { callbackPath: '/', oauthQuery: currentOAuthQuery() }
      : { callbackPath: safeRedirectPath(route.query.redirect) })
    window.location.assign(url)
  }
  catch {
    error.value = t('serverAuth.signIn.failed')
    isLoading.value = false
  }
}
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
        @click="signIn"
      >
        <span v-if="isLoading" class="i-lucide-loader-2 mr-2 animate-spin" />
        <span v-else class="i-lucide-send mr-2 h-5 w-5" />
        {{ isLoading ? t('login.processing') : t('serverAuth.signIn.withTelegram') }}
      </Button>
      <p class="text-center text-xs text-muted-foreground">
        {{ t('serverAuth.signIn.notice') }}
      </p>
    </div>
  </AuthCard>
</template>
