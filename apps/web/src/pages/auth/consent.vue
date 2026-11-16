<script setup lang="ts">
import type { PublicClient } from '../../lib/server-auth'

import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import AuthCard from '../../components/auth/AuthCard.vue'
import ScopeList from '../../components/auth/ScopeList.vue'

import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { currentOAuthQuery, getPublicClient, ServerAuthError, SIGN_IN_PATH, submitConsent } from '../../lib/server-auth'

defineOptions({ layout: false })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const clientId = computed(() => typeof route.query.client_id === 'string' ? route.query.client_id : '')
const scopes = computed(() => typeof route.query.scope === 'string' ? route.query.scope.split(' ').filter(Boolean) : [])
const client = ref<PublicClient>()
const clientHost = computed(() => {
  try {
    return client.value?.uri ? new URL(client.value.uri).host : undefined
  }
  catch {
    return undefined
  }
})
const submitting = ref<'accept' | 'deny'>()
const error = ref('')

onMounted(async () => {
  if (!clientId.value) {
    error.value = t('serverAuth.consent.invalidRequest')
    return
  }
  try {
    client.value = await getPublicClient(clientId.value)
  }
  catch (cause) {
    // The session expired between sign-in and consent; sign in again and return here.
    if (cause instanceof ServerAuthError && cause.status === 401)
      await router.replace({ path: SIGN_IN_PATH, query: { redirect: route.fullPath } })
    else
      error.value = t('serverAuth.consent.invalidRequest')
  }
})

async function decide(accept: boolean) {
  submitting.value = accept ? 'accept' : 'deny'
  error.value = ''
  try {
    window.location.assign(await submitConsent({ accept, oauthQuery: currentOAuthQuery() }))
  }
  catch {
    error.value = t('serverAuth.consent.failed')
    submitting.value = undefined
  }
}
</script>

<template>
  <AuthCard
    icon="i-lucide-shield-check"
    :title="t('serverAuth.consent.title', { client: client?.name ?? clientId })"
    :description="clientHost ? t('serverAuth.consent.from', { host: clientHost }) : t('serverAuth.consent.description')"
  >
    <div class="flex flex-col gap-4">
      <Alert v-if="error">
        {{ error }}
      </Alert>
      <template v-if="client">
        <ScopeList :scopes="scopes" />
        <p class="text-xs text-fg-3">
          {{ t('serverAuth.consent.notice') }}
        </p>
        <div class="flex flex-col gap-2">
          <Button
            variant="primary" :loading="submitting === 'accept'"
            type="button"
            size="lg"
            block
            :disabled="submitting !== undefined"
            @click="decide(true)"
          >
            {{ t('serverAuth.consent.allow') }}
          </Button>
          <Button
            type="button"
            variant="text"
            size="lg"
            block
            :disabled="submitting !== undefined"
            @click="decide(false)"
          >
            {{ t('serverAuth.consent.deny') }}
          </Button>
        </div>
      </template>
    </div>
  </AuthCard>
</template>
