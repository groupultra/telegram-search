<script setup lang="ts">
import type { DeviceAuthorization, PublicClient } from '../../lib/server-auth'

import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import AuthCard from '../../components/auth/AuthCard.vue'
import ScopeList from '../../components/auth/ScopeList.vue'

import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { decideDeviceAuthorization, getDeviceAuthorization, getPublicClient, normalizeUserCode, ServerAuthError, SIGN_IN_PATH } from '../../lib/server-auth'
import { LOGIN_DESKTOP_INPUT_CLASS, LOGIN_DESKTOP_PRIMARY_BUTTON_CLASS } from '../login/styles'

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
    <div class="space-y-6">
      <p v-if="error" role="alert" class="border border-destructive/30 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {{ error }}
      </p>

      <div v-if="decided" class="text-center">
        <span :class="decided === 'approved' ? 'i-lucide-circle-check text-primary' : 'i-lucide-circle-x text-muted-foreground'" class="mx-auto mb-4 block h-12 w-12" />
        <p class="text-base">
          {{ decided === 'approved' ? t('serverAuth.device.approved') : t('serverAuth.device.denied') }}
        </p>
      </div>

      <template v-else-if="authorization">
        <p class="text-center text-2xl tracking-[0.3em] font-mono">
          {{ authorization.userCode }}
        </p>
        <ScopeList :scopes="authorization.scopes" />
        <div class="flex flex-col gap-3">
          <Button as="button" type="button" size="lg" :class="LOGIN_DESKTOP_PRIMARY_BUTTON_CLASS" :disabled="isLoading" @click="decide(true)">
            <span v-if="isLoading" class="i-lucide-loader-2 mr-2 animate-spin" />
            {{ t('serverAuth.device.approve') }}
          </Button>
          <Button as="button" type="button" variant="ghost" size="lg" class="w-full rounded-xl" :disabled="isLoading" @click="decide(false)">
            {{ t('serverAuth.device.deny') }}
          </Button>
        </div>
      </template>

      <form v-else class="space-y-6" @submit.prevent="lookUp">
        <div class="space-y-3">
          <label for="userCode" class="text-sm font-medium">{{ t('serverAuth.device.code') }}</label>
          <div class="group relative">
            <div class="absolute left-3 top-1/2 text-muted-foreground transition-colors -translate-y-1/2 group-focus-within:text-primary">
              <span class="i-lucide-key-round h-5 w-5" />
            </div>
            <Input
              id="userCode"
              v-model="userCode"
              type="text"
              autocomplete="one-time-code"
              autocapitalize="characters"
              :class="`${LOGIN_DESKTOP_INPUT_CLASS} font-mono uppercase tracking-widest`"
              required
              :disabled="isLoading"
            />
          </div>
        </div>
        <Button as="button" type="submit" size="lg" :class="LOGIN_DESKTOP_PRIMARY_BUTTON_CLASS" :disabled="isLoading">
          <span v-if="isLoading" class="i-lucide-loader-2 mr-2 animate-spin" />
          {{ t('login.continue') }}
        </Button>
      </form>
    </div>
  </AuthCard>
</template>
