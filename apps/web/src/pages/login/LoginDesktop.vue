<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useLoginFlow } from '../../composables/useLoginFlow'
import {
  LOGIN_DESKTOP_INPUT_CLASS,
  LOGIN_DESKTOP_PRIMARY_BUTTON_CLASS,
  LOGIN_DESKTOP_SUCCESS_BADGE_CLASS,
  LOGIN_GRADIENT_TITLE_CLASS,
  LOGIN_TRANSITION_ENTER_ACTIVE_CLASS,
  LOGIN_TRANSITION_ENTER_FROM_CLASS,
  LOGIN_TRANSITION_ENTER_TO_CLASS,
  LOGIN_TRANSITION_LEAVE_ACTIVE_CLASS,
  LOGIN_TRANSITION_LEAVE_FROM_CLASS,
  LOGIN_TRANSITION_LEAVE_TO_CLASS,
} from './styles'

const { t } = useI18n()
const { accountStore, state, steps, handleLogin, redirectRoot } = useLoginFlow()
</script>

<template>
  <div class="relative isolate min-h-screen flex items-center justify-center overflow-hidden p-4 font-sans">
    <div
      class="[animation-duration:800ms] [animation-timing-function:cubic-bezier(0.16,1,0.3,1)] relative z-10 max-w-md w-full animate-in overflow-hidden border border-border/60 rounded-3xl bg-card/95 px-10 py-12 shadow-2xl backdrop-blur-xl transition-all duration-1000 fade-in zoom-in-95 slide-in-from-bottom-4 md:px-12"
    >
      <!-- Header -->
      <div class="mb-10 text-center">
        <div class="mx-auto mb-8 h-16 w-16 flex items-center justify-center rounded-2xl from-primary/20 to-primary/5 bg-gradient-to-br text-primary shadow-inner ring-1 ring-border/50">
          <span class="i-lucide-search h-8 w-8" />
        </div>
        <h1 :class="`text-3xl ${LOGIN_GRADIENT_TITLE_CLASS}`">
          {{ t('login.telegramLogin') }}
        </h1>
        <p class="mt-4 text-base text-muted-foreground/80">
          {{ steps.find(s => s.value === state.currentStep)?.description }}
        </p>
      </div>

      <!-- Step Indicator -->
      <div class="mb-12 flex justify-center gap-2">
        <div
          v-for="(step, idx) in steps"
          :key="step.value"
          class="h-1.5 flex-1 rounded-full transition-all duration-500"
          :class="[
            state.currentStep === step.value ? 'bg-primary shadow-sm'
            : idx < steps.findIndex(s => s.value === state.currentStep) ? 'bg-primary/40' : 'bg-muted/30',
          ]"
        />
      </div>

      <!-- Forms -->
      <div class="relative min-h-[200px]">
        <Transition
          :enter-active-class="LOGIN_TRANSITION_ENTER_ACTIVE_CLASS"
          :enter-from-class="LOGIN_TRANSITION_ENTER_FROM_CLASS"
          :enter-to-class="LOGIN_TRANSITION_ENTER_TO_CLASS"
          :leave-active-class="LOGIN_TRANSITION_LEAVE_ACTIVE_CLASS"
          :leave-from-class="LOGIN_TRANSITION_LEAVE_FROM_CLASS"
          :leave-to-class="LOGIN_TRANSITION_LEAVE_TO_CLASS"
        >
          <!-- Phone number form -->
          <form v-if="state.currentStep === 'phone'" key="phone" class="space-y-8" @submit.prevent="handleLogin">
            <div class="space-y-4">
              <label for="phoneNumber" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{{ t('login.phoneNumber') }}</label>
              <div class="group relative">
                <div class="absolute left-3 top-1/2 text-muted-foreground transition-colors -translate-y-1/2 group-focus-within:text-primary">
                  <span class="i-lucide-phone h-5 w-5" />
                </div>
                <Input
                  id="phoneNumber"
                  v-model="state.phoneNumber"
                  type="tel"
                  :placeholder="t('login.phonePlaceholder')"
                  :class="LOGIN_DESKTOP_INPUT_CLASS"
                  required
                  :disabled="accountStore.auth.isLoading"
                  auto-focus
                />
              </div>
            </div>
            <Button
              as="button"
              type="submit"
              size="lg"
              :class="LOGIN_DESKTOP_PRIMARY_BUTTON_CLASS"
              :disabled="accountStore.auth.isLoading"
            >
              <span v-if="accountStore.auth.isLoading" class="i-lucide-loader-2 mr-2 animate-spin" />
              {{ accountStore.auth.isLoading ? t('login.processing') : t('login.login') }}
              <span v-if="!accountStore.auth.isLoading" class="i-lucide-arrow-right ml-2 h-5 w-5" />
            </Button>
          </form>

          <!-- Verification code form -->
          <form v-else-if="state.currentStep === 'code'" key="code" class="space-y-8" @submit.prevent="handleLogin">
            <div class="space-y-4">
              <label for="verificationCode" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{{ t('login.verificationCode') }}</label>
              <div class="group relative">
                <div class="absolute left-3 top-1/2 text-muted-foreground transition-colors -translate-y-1/2 group-focus-within:text-primary">
                  <span class="i-lucide-key-round h-5 w-5" />
                </div>
                <Input
                  id="verificationCode"
                  v-model="state.verificationCode"
                  type="text"
                  :class="LOGIN_DESKTOP_INPUT_CLASS"
                  required
                  :disabled="accountStore.auth.isLoading"
                  auto-focus
                />
              </div>
            </div>
            <Button
              as="button"
              type="submit"
              size="lg"
              :class="LOGIN_DESKTOP_PRIMARY_BUTTON_CLASS"
              :disabled="accountStore.auth.isLoading"
            >
              <span v-if="accountStore.auth.isLoading" class="i-lucide-loader-2 mr-2 animate-spin" />
              {{ accountStore.auth.isLoading ? t('login.processing') : t('login.verify') }}
              <span v-if="!accountStore.auth.isLoading" class="i-lucide-check ml-2 h-5 w-5" />
            </Button>
            <div class="text-center">
              <Button
                as="button"
                type="button"
                variant="ghost"
                size="sm"
                class="gap-2 text-muted-foreground hover:bg-transparent hover:text-primary"
                @click="state.currentStep = 'phone'"
              >
                <span class="i-lucide-arrow-left h-4 w-4" />
                {{ t('common.back') }}
              </Button>
            </div>
          </form>

          <!-- Two-factor authentication password form -->
          <form v-else-if="state.currentStep === 'password'" key="password" class="space-y-8" @submit.prevent="handleLogin">
            <div class="space-y-4">
              <label for="twoFactorPassword" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{{ t('login.twoFactorPassword') }}</label>
              <div class="group relative">
                <div class="absolute left-3 top-1/2 text-muted-foreground transition-colors -translate-y-1/2 group-focus-within:text-primary">
                  <span class="i-lucide-lock h-5 w-5" />
                </div>
                <Input
                  id="twoFactorPassword"
                  v-model="state.twoFactorPassword"
                  type="password"
                  :class="LOGIN_DESKTOP_INPUT_CLASS"
                  required
                  :disabled="accountStore.auth.isLoading"
                  auto-focus
                />
              </div>
            </div>
            <Button
              as="button"
              type="submit"
              size="lg"
              :class="LOGIN_DESKTOP_PRIMARY_BUTTON_CLASS"
              :disabled="accountStore.auth.isLoading"
            >
              <span v-if="accountStore.auth.isLoading" class="i-lucide-loader-2 mr-2 animate-spin" />
              {{ accountStore.auth.isLoading ? t('login.processing') : t('login.login') }}
              <span v-if="!accountStore.auth.isLoading" class="i-lucide-log-in ml-2 h-5 w-5" />
            </Button>
          </form>

          <!-- Login complete -->
          <div v-else-if="state.currentStep === 'complete'" key="complete" class="flex flex-col items-center justify-center text-center">
            <div :class="LOGIN_DESKTOP_SUCCESS_BADGE_CLASS">
              <span class="i-lucide-party-popper h-12 w-12 animate-bounce" />
            </div>
            <h2 :class="`text-3xl ${LOGIN_GRADIENT_TITLE_CLASS}`">
              {{ t('login.loginSuccess') }}
            </h2>
            <p class="mt-2 text-muted-foreground">
              {{ t('login.loginSuccessDescription') }}
            </p>
            <Button
              size="lg"
              :class="`mt-8 ${LOGIN_DESKTOP_PRIMARY_BUTTON_CLASS}`"
              @click="redirectRoot"
            >
              {{ t('login.enterHome') }}
              <span class="i-lucide-home ml-2 h-5 w-5" />
            </Button>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>
