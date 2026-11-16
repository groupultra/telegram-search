<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import AuthCard from '../components/auth/AuthCard.vue'

import { Button } from '../components/ui/Button'
import { FormItem } from '../components/ui/FormItem'
import { Input } from '../components/ui/Input'
import { useLoginFlow } from '../composables/useLoginFlow'

const { t } = useI18n()
const { accountStore, state, steps, handleLogin, redirectRoot } = useLoginFlow()

const currentStepIndex = computed(() => Math.max(steps.value.findIndex(step => step.value === state.value.currentStep), 0))
const currentStepDescription = computed(() => steps.value[currentStepIndex.value]?.description)
const isLoading = computed(() => accountStore.auth.isLoading)
</script>

<template>
  <!-- One responsive screen replaces the former desktop and mobile variants. -->
  <AuthCard icon="i-lucide-search" :title="t('login.telegramLogin')" :description="currentStepDescription">
    <!-- Step Indicator -->
    <div class="flex gap-1" role="progressbar" :aria-valuenow="currentStepIndex + 1" :aria-valuemin="1" :aria-valuemax="steps.length">
      <div
        v-for="(step, idx) in steps"
        :key="step.value"
        class="h-1 flex-1 rounded-full transition-colors duration-300"
        :class="idx <= currentStepIndex ? 'bg-primary' : 'bg-fill-2'"
      />
    </div>

    <!-- Phone number form -->
    <form v-if="state.currentStep === 'phone'" class="flex flex-col gap-4" @submit.prevent="handleLogin">
      <FormItem :label="t('login.phoneNumber')" for="phoneNumber">
        <Input
          id="phoneNumber"
          v-model="state.phoneNumber"
          type="tel"
          size="lg"
          prefix-icon="i-lucide-phone"
          :placeholder="t('login.phonePlaceholder')"
          required
          :disabled="isLoading"
          autofocus
        />
      </FormItem>
      <Button variant="primary" type="submit" size="lg" block :loading="isLoading">
        {{ isLoading ? t('login.processing') : t('login.login') }}
      </Button>
    </form>

    <!-- Verification code form -->
    <form v-else-if="state.currentStep === 'code'" class="flex flex-col gap-4" @submit.prevent="handleLogin">
      <FormItem :label="t('login.verificationCode')" for="verificationCode">
        <Input
          id="verificationCode"
          v-model="state.verificationCode"
          type="text"
          size="lg"
          prefix-icon="i-lucide-key-round"
          required
          :disabled="isLoading"
          autofocus
        />
      </FormItem>
      <Button variant="primary" type="submit" size="lg" block :loading="isLoading">
        {{ isLoading ? t('login.processing') : t('login.verify') }}
      </Button>
      <Button variant="text" size="lg" block icon="i-lucide-arrow-left" @click="state.currentStep = 'phone'">
        {{ t('common.back') }}
      </Button>
    </form>

    <!-- Two-factor authentication password form -->
    <form v-else-if="state.currentStep === 'password'" class="flex flex-col gap-4" @submit.prevent="handleLogin">
      <FormItem :label="t('login.twoFactorPassword')" for="twoFactorPassword">
        <Input
          id="twoFactorPassword"
          v-model="state.twoFactorPassword"
          type="password"
          size="lg"
          prefix-icon="i-lucide-lock"
          required
          :disabled="isLoading"
          autofocus
        />
      </FormItem>
      <Button variant="primary" type="submit" size="lg" block :loading="isLoading">
        {{ isLoading ? t('login.processing') : t('login.login') }}
      </Button>
    </form>

    <!-- Login complete -->
    <div v-else-if="state.currentStep === 'complete'" class="flex flex-col gap-4">
      <div>
        <h2 class="flex items-center gap-2 text-sm text-fg font-semibold leading-6">
          <span class="i-lucide-circle-check h-4 w-4 text-success" />
          {{ t('login.loginSuccess') }}
        </h2>
        <p class="text-sm text-fg-2">
          {{ t('login.loginSuccessDescription') }}
        </p>
      </div>
      <Button variant="primary" size="lg" block @click="redirectRoot">
        {{ t('login.enterHome') }}
      </Button>
    </div>
  </AuthCard>
</template>
