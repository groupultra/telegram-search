<script setup lang="ts">
import type { DeviceAuthorization, PublicClient } from '../../lib/server-auth'

import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import AuthCard from '../../components/auth/AuthCard.vue'
import ScopeList from '../../components/auth/ScopeList.vue'

import { Alert } from '../../components/ui/Alert'
import { Button } from '../../components/ui/Button'
import { FormItem } from '../../components/ui/FormItem'
import { Input } from '../../components/ui/Input'
import { decideDeviceAuthorization, getDeviceAuthorization, getPublicClient, normalizeUserCode, ServerAuthError, SIGN_IN_PATH } from '../../lib/server-auth'

defineOptions({ layout: false })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const userCode = ref(typeof route.query.user_code === 'string' ? route.query.user_code : '')
const authorization = ref<DeviceAuthorization>()
const client = ref<PublicClient>()
const isLoading = ref(false)
const decided = ref<'approved' | 'denied'>()
const error = ref('')

async function signInAndReturn() {
  await router.replace({ path: SIGN_IN_PATH, query: { redirect: `/auth/device?${new URLSearchParams({ user_code: normalizeUserCode(userCode.value) })}` } })
}

async function lookUp() {
  if (!normalizeUserCode(userCode.value))
    return
  isLoading.value = true
  error.value = ''
  try {
    authorization.value = await getDeviceAuthorization(userCode.value)
    if (authorization.value.status !== 'pending')
      decided.value = authorization.value.status
    client.value = authorization.value.clientId
      ? await getPublicClient(authorization.value.clientId).catch(() => ({ clientId: authorization.value!.clientId! }))
      : undefined
  }
  catch (cause) {
    if (cause instanceof ServerAuthError && cause.status === 401)
      await signInAndReturn()
    else
      error.value = t('serverAuth.device.invalidCode')
  }
  finally {
    isLoading.value = false
  }
}

async function decide(approve: boolean) {
  if (!authorization.value)
    return
  isLoading.value = true
  error.value = ''
  try {
    await decideDeviceAuthorization(authorization.value.userCode, approve)
    decided.value = approve ? 'approved' : 'denied'
  }
  catch (cause) {
    // The session expired after the lookup; sign in again and come back to this code.
    if (cause instanceof ServerAuthError && cause.status === 401)
      await signInAndReturn()
    else
      error.value = t('serverAuth.device.failed')
  }
  finally {
    isLoading.value = false
  }
}

onMounted(() => {
  if (userCode.value)
    void lookUp()
})
</script>

<template>
  <AuthCard
    icon="i-lucide-terminal"
    :title="t('serverAuth.device.title')"
    :description="decided ? undefined : authorization ? t('serverAuth.device.confirm', { client: client?.name ?? client?.clientId ?? '' }) : t('serverAuth.device.description')"
  >
    <div class="flex flex-col gap-4">
      <Alert v-if="error">
        {{ error }}
      </Alert>

      <div v-if="decided" class="text-center">
        <span :class="decided === 'approved' ? 'i-lucide-circle-check text-success' : 'i-lucide-circle-x text-fg-3'" class="mx-auto mb-3 block h-8 w-8" />
        <p class="text-sm text-fg">
          {{ decided === 'approved' ? t('serverAuth.device.approved') : t('serverAuth.device.denied') }}
        </p>
      </div>

      <template v-else-if="authorization">
        <p class="text-center text-2xl tracking-[0.3em] font-mono">
          {{ authorization.userCode }}
        </p>
        <ScopeList :scopes="authorization.scopes" />
        <div class="flex flex-col gap-2">
          <Button variant="primary" :loading="isLoading" type="button" size="lg" block :disabled="isLoading" @click="decide(true)">
            {{ t('serverAuth.device.approve') }}
          </Button>
          <Button type="button" variant="text" size="lg" block :disabled="isLoading" @click="decide(false)">
            {{ t('serverAuth.device.deny') }}
          </Button>
        </div>
      </template>

      <form v-else class="flex flex-col gap-4" @submit.prevent="lookUp">
        <FormItem :label="t('serverAuth.device.code')" for="userCode">
          <Input
            id="userCode"
            v-model="userCode"
            type="text"
            size="lg"
            prefix-icon="i-lucide-key-round"
            autocomplete="one-time-code"
            autocapitalize="characters"
            class="tracking-widest font-mono uppercase"
            required
            :disabled="isLoading"
          />
        </FormItem>
        <Button variant="primary" :loading="isLoading" type="submit" size="lg" block :disabled="isLoading">
          {{ t('login.continue') }}
        </Button>
      </form>
    </div>
  </AuthCard>
</template>
