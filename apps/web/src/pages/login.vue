<script setup lang="ts">
import { useAuthStore, useAvatarStore, useBridgeStore } from '@tg-search/client'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import Stepper from '../components/ui/Stepper.vue'

const { t } = useI18n()
type LoginStep = 'phone' | 'code' | 'password' | 'complete'

const router = useRouter()
const route = useRoute()

const authStore = useAuthStore()
const websocketStore = useBridgeStore()
const avatarStore = useAvatarStore()
const { isLoggedIn } = storeToRefs(authStore)

const state = ref({
  currentStep: 'phone' as LoginStep,
  showAdvancedSettings: false,
  phoneNumber: '',
  verificationCode: '',
  twoFactorPassword: '',
})
authStore.auth.needCode = false
authStore.auth.needPassword = false
authStore.auth.isLoading = false

const {
  login,
  submitCode,
  submitPassword,
} = authStore.handleAuth()

watch(() => authStore.auth.needCode, (value) => {
  if (value) {
    authStore.auth.isLoading = false
    state.value.currentStep = 'code'
  }
})

watch(() => authStore.auth.needPassword, (value) => {
  if (value) {
    authStore.auth.isLoading = false
    state.value.currentStep = 'password'
  }
})

watch(isLoggedIn, (value) => {
  if (value) {
    authStore.auth.isLoading = false
    state.value.currentStep = 'complete'

    // High-priority fetch for self avatar to avoid being queued behind chat list
    const me = websocketStore.getActiveSession()?.me
    if (me?.id) {
      // Force refresh to always get the latest avatar on login
      avatarStore.ensureUserAvatar(me.id, undefined, true)
    }
  }
})

const steps = computed(() => [
  { step: 1, value: 'phone', title: t('login.phone'), description: t('login.phoneDescription') },
  { step: 2, value: 'code', title: t('login.code'), description: t('login.codeDescription') },
  { step: 3, value: 'password', title: t('login.password'), description: t('login.passwordDescription') },
  { step: 4, value: 'complete', title: t('login.complete'), description: t('login.completeDescription') },
])

function redirectRoot() {
  // Redirect to the previous page if specified in query params, otherwise go to sync page
  const redirect = route.query.redirect as string | undefined
  router.push(redirect || '/sync')
}

async function handleLogin() {
  authStore.auth.isLoading = true

  try {
    switch (state.value.currentStep) {
      case 'phone':
        login(state.value.phoneNumber)
        break
      case 'code':
        submitCode(state.value.verificationCode)
        break
      case 'password':
        submitPassword(state.value.twoFactorPassword)
        break
    }
  }
  catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background">
    <div class="max-w-md w-full rounded-2xl bg-card p-10 shadow-2xl">
      <h1 class="mb-6 text-center text-3xl font-bold tracking-tight">
        {{ t('login.telegramLogin') }}
      </h1>
      <Stepper :steps="steps" :current-step="state.currentStep" />
      <p class="mb-8 text-center text-lg text-muted-foreground font-medium">
        {{ steps.find(s => s.value === state.currentStep)?.description }}
      </p>

      <!-- Phone number form -->
      <form v-if="state.currentStep === 'phone'" class="space-y-6" @submit.prevent="handleLogin">
        <div>
          <label for="phoneNumber" class="mb-2 block text-base font-semibold">{{ t('login.phoneNumber') }}</label>
          <input
            id="phoneNumber"
            v-model="state.phoneNumber"
            type="tel"
            :placeholder="t('login.phoneNumberPlaceholder')"
            class="w-full border rounded-xl bg-background px-5 py-4 text-xl transition disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-ring"
            required
            :disabled="authStore.auth.isLoading"
          >
        </div>
        <button
          type="submit"
          class="w-full flex items-center justify-center rounded-xl bg-primary py-4 text-lg text-primary-foreground font-bold transition disabled:cursor-not-allowed hover:bg-primary/90 disabled:opacity-50"
          :disabled="authStore.auth.isLoading"
        >
          <span v-if="authStore.auth.isLoading" class="i-lucide-loader-2 mr-2 animate-spin" />
          {{ authStore.auth.isLoading ? t('login.processing') : t('login.login') }}
        </button>
      </form>

      <!-- Verification code form -->
      <form v-if="state.currentStep === 'code'" class="space-y-6" @submit.prevent="handleLogin">
        <div>
          <label for="verificationCode" class="mb-2 block text-base font-semibold">{{ t('login.verificationCode') }}</label>
          <input
            id="verificationCode"
            v-model="state.verificationCode"
            type="text"
            class="w-full border rounded-xl bg-background px-5 py-4 text-xl transition disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-ring"
            required
            :disabled="authStore.auth.isLoading"
          >
        </div>
        <button
          type="submit"
          class="w-full flex items-center justify-center rounded-xl bg-primary py-4 text-lg text-primary-foreground font-bold transition disabled:cursor-not-allowed hover:bg-primary/90 disabled:opacity-50"
          :disabled="authStore.auth.isLoading"
        >
          <span v-if="authStore.auth.isLoading" class="i-lucide-loader-2 mr-2 animate-spin" />
          {{ authStore.auth.isLoading ? t('login.processing') : t('login.verify') }}
        </button>
      </form>

      <!-- Two-factor authentication password form -->
      <form v-if="state.currentStep === 'password'" class="space-y-6" @submit.prevent="handleLogin">
        <div>
          <label for="twoFactorPassword" class="mb-2 block text-base font-semibold">{{ t('login.twoFactorPassword') }}</label>
          <input
            id="twoFactorPassword"
            v-model="state.twoFactorPassword"
            type="password"
            class="w-full border rounded-xl bg-background px-5 py-4 text-xl transition disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-ring"
            required
            :disabled="authStore.auth.isLoading"
          >
        </div>
        <button
          type="submit"
          class="w-full flex items-center justify-center rounded-xl bg-primary py-4 text-lg text-primary-foreground font-bold transition disabled:cursor-not-allowed hover:bg-primary/90 disabled:opacity-50"
          :disabled="authStore.auth.isLoading"
        >
          <span v-if="authStore.auth.isLoading" class="i-lucide-loader-2 mr-2 animate-spin" />
          {{ authStore.auth.isLoading ? t('login.processing') : t('login.login') }}
        </button>
      </form>

      <!-- Login complete -->
      <div v-if="state.currentStep === 'complete'" class="text-center">
        <div class="mb-4 text-3xl">
          🎉
        </div>
        <h2 class="text-xl font-bold">
          {{ t('login.loginSuccess') }}
        </h2>
        <p class="mt-2 text-lg text-muted-foreground">
          {{ t('login.loginSuccessDescription') }}
        </p>
        <button
          class="mt-6 w-full rounded-xl bg-primary py-4 text-lg text-primary-foreground font-bold transition hover:bg-primary/90"
          @click="redirectRoot"
        >
          {{ t('login.enterHome') }}
        </button>
      </div>
    </div>
  </div>
</template>
