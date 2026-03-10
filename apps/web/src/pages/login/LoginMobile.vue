<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useLoginFlow } from '../../composables/useLoginFlow'
import {
  LOGIN_GRADIENT_TITLE_CLASS,
  LOGIN_MOBILE_INPUT_CLASS,
  LOGIN_MOBILE_PRIMARY_BUTTON_CLASS,
  LOGIN_MOBILE_SUCCESS_BADGE_CLASS,
  LOGIN_MOBILE_SUCCESS_BUTTON_CLASS,
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
  <div class="relative h-[100dvh] w-full flex flex-col overflow-hidden text-foreground font-sans">
    <!-- Main Container -->
    <div class="relative z-10 w-full flex flex-1 flex-col items-center justify-end p-0">
      <!-- Card / Bottom Sheet -->
      <div
        class="min-h-[58dvh] w-full animate-in rounded-t-[32px] bg-background/88 px-5 pb-6 pt-5 shadow-2xl backdrop-blur-2xl transition-all duration-500 fade-in slide-in-from-bottom-10"
      >
        <!-- Mobile Handle -->
        <div class="mx-auto mb-6 h-1.5 w-12 rounded-full bg-muted" />

        <!-- Header -->
        <div class="mb-8 text-center">
          <div class="mx-auto mb-6 h-15 w-15 flex items-center justify-center rounded-2xl from-primary/20 to-primary/5 bg-gradient-to-br text-primary shadow-inner ring-1 ring-border/50">
            <span class="i-lucide-search h-7 w-7" />
          </div>
          <h1 :class="`text-3xl ${LOGIN_GRADIENT_TITLE_CLASS}`">
            {{ t('login.telegramLogin') }}
          </h1>
          <p class="mt-3 text-base text-muted-foreground/80">
            {{ steps.find(s => s.value === state.currentStep)?.description }}
          </p>
        </div>

        <!-- Step Indicator -->
        <div class="mb-10 flex justify-center gap-2">
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

        <!-- Forms Container -->
        <div class="relative min-h-[220px] pt-2">
          <Transition
            :enter-active-class="LOGIN_TRANSITION_ENTER_ACTIVE_CLASS"
            :enter-from-class="LOGIN_TRANSITION_ENTER_FROM_CLASS"
            :enter-to-class="LOGIN_TRANSITION_ENTER_TO_CLASS"
            :leave-active-class="LOGIN_TRANSITION_LEAVE_ACTIVE_CLASS"
            :leave-from-class="LOGIN_TRANSITION_LEAVE_FROM_CLASS"
            :leave-to-class="LOGIN_TRANSITION_LEAVE_TO_CLASS"
          >
            <!-- Phone Form -->
            <form v-if="state.currentStep === 'phone'" key="phone" class="space-y-8" @submit.prevent="handleLogin">
              <div class="space-y-3">
                <label for="phoneNumber" class="text-sm font-medium leading-none">
                  {{ t('login.phoneNumber') }}
                </label>
                <div class="group relative">
                  <div class="absolute left-4 top-1/2 text-muted-foreground transition-colors -translate-y-1/2 group-focus-within:text-primary">
                    <span class="i-lucide-phone h-5 w-5" />
                  </div>
                  <Input
                    id="phoneNumber"
                    v-model="state.phoneNumber"
                    type="tel"
                    :placeholder="t('login.phonePlaceholder')"
                    :class="LOGIN_MOBILE_INPUT_CLASS"
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
                :class="LOGIN_MOBILE_PRIMARY_BUTTON_CLASS"
                :disabled="accountStore.auth.isLoading"
              >
                <span v-if="accountStore.auth.isLoading" class="i-lucide-loader-2 mr-2 animate-spin" />
                {{ accountStore.auth.isLoading ? t('login.processing') : t('login.continue') }}
                <span v-if="!accountStore.auth.isLoading" class="i-lucide-arrow-right ml-2 h-5 w-5" />
              </Button>
            </form>

            <!-- Code Form -->
            <form v-else-if="state.currentStep === 'code'" key="code" class="space-y-8" @submit.prevent="handleLogin">
              <div class="space-y-3">
                <label for="verificationCode" class="text-sm font-medium leading-none">
                  {{ t('login.verificationCode') }}
                </label>
                <div class="group relative">
                  <div class="absolute left-4 top-1/2 text-muted-foreground transition-colors -translate-y-1/2 group-focus-within:text-primary">
                    <span class="i-lucide-key-round h-5 w-5" />
                  </div>
                  <Input
                    id="verificationCode"
                    v-model="state.verificationCode"
                    type="text"
                    :placeholder="t('login.enterCodePlaceholder')"
                    :class="LOGIN_MOBILE_INPUT_CLASS"
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
                :class="LOGIN_MOBILE_PRIMARY_BUTTON_CLASS"
                :disabled="accountStore.auth.isLoading"
              >
                <span v-if="accountStore.auth.isLoading" class="i-lucide-loader-2 mr-2 animate-spin" />
                {{ accountStore.auth.isLoading ? t('login.processing') : t('login.verify') }}
                <span v-if="!accountStore.auth.isLoading" class="i-lucide-check ml-2 h-5 w-5" />
              </Button>

              <div class="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  class="gap-2 text-muted-foreground hover:text-primary"
                  @click="state.currentStep = 'phone'"
                >
                  <span class="i-lucide-arrow-left h-4 w-4" />
                  {{ t('login.changePhone') }}
                </Button>
              </div>
            </form>

            <!-- Password Form -->
            <form v-else-if="state.currentStep === 'password'" key="password" class="space-y-8" @submit.prevent="handleLogin">
              <div class="space-y-3">
                <label for="twoFactorPassword" class="text-sm font-medium leading-none">
                  {{ t('login.twoFactorPassword') }}
                </label>
                <div class="group relative">
                  <div class="absolute left-4 top-1/2 text-muted-foreground transition-colors -translate-y-1/2 group-focus-within:text-primary">
                    <span class="i-lucide-lock h-5 w-5" />
                  </div>
                  <Input
                    id="twoFactorPassword"
                    v-model="state.twoFactorPassword"
                    type="password"
                    :placeholder="t('login.passwordPlaceholder')"
                    :class="LOGIN_MOBILE_INPUT_CLASS"
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
                :class="LOGIN_MOBILE_PRIMARY_BUTTON_CLASS"
                :disabled="accountStore.auth.isLoading"
              >
                <span v-if="accountStore.auth.isLoading" class="i-lucide-loader-2 mr-2 animate-spin" />
                {{ accountStore.auth.isLoading ? t('login.processing') : t('login.login') }}
                <span v-if="!accountStore.auth.isLoading" class="i-lucide-log-in ml-2 h-5 w-5" />
              </Button>
            </form>

            <!-- Complete -->
            <div v-else-if="state.currentStep === 'complete'" key="complete" class="flex flex-col items-center justify-center text-center space-y-6">
              <div :class="LOGIN_MOBILE_SUCCESS_BADGE_CLASS">
                <span class="i-lucide-check h-10 w-10" />
              </div>
              <h2 :class="`text-2xl ${LOGIN_GRADIENT_TITLE_CLASS}`">
                {{ t('login.loginSuccess') }}
              </h2>
              <Button
                size="lg"
                :class="LOGIN_MOBILE_SUCCESS_BUTTON_CLASS"
                @click="redirectRoot"
              >
                {{ t('login.enterHome') }}
              </Button>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </div>
</template>
