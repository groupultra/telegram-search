<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useLoginFlow } from '../../composables/useLoginFlow'
import {
  LOGIN_MOBILE_INPUT_CLASS,
  LOGIN_MOBILE_PRIMARY_BUTTON_CLASS,
  LOGIN_MOBILE_SUCCESS_BADGE_CLASS,
  LOGIN_MOBILE_SUCCESS_BUTTON_CLASS,
  LOGIN_TITLE_CLASS,
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
    <div class="relative z-10 w-full flex flex-1 flex-col p-0">
      <div class="w-full flex flex-1 flex-col animate-in px-6 pb-8 pt-16 duration-500 fade-in slide-in-from-bottom-2">
        <!-- Header -->
        <div class="mb-8">
          <div class="mb-8 h-10 w-10 flex items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <span class="i-lucide-search h-5 w-5" />
          </div>
          <h1 :class="`text-2xl ${LOGIN_TITLE_CLASS}`">
            {{ t('login.telegramLogin') }}
          </h1>
          <p class="mt-2 text-sm text-muted-foreground">
            {{ steps.find(s => s.value === state.currentStep)?.description }}
          </p>
        </div>

        <!-- Step Indicator -->
        <div class="mb-8 flex items-center gap-3">
          <span class="text-xs text-muted-foreground font-mono tabular-nums">
            {{ String(Math.max(steps.findIndex(s => s.value === state.currentStep), 0) + 1).padStart(2, '0') }} / {{ String(steps.length).padStart(2, '0') }}
          </span>
          <div class="flex flex-1 gap-1">
            <div
              v-for="(step, idx) in steps"
              :key="step.value"
              class="h-0.5 flex-1 rounded-full transition-colors duration-300"
              :class="idx <= steps.findIndex(s => s.value === state.currentStep) ? 'bg-primary' : 'bg-border'"
            />
          </div>
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
                  <div class="absolute left-4 top-1/2 text-muted-foreground transition-colors -translate-y-1/2 group-focus-within:text-foreground">
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
                  <div class="absolute left-4 top-1/2 text-muted-foreground transition-colors -translate-y-1/2 group-focus-within:text-foreground">
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
                  class="gap-2 text-muted-foreground hover:text-foreground"
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
                  <div class="absolute left-4 top-1/2 text-muted-foreground transition-colors -translate-y-1/2 group-focus-within:text-foreground">
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
                <span class="i-lucide-check h-7 w-7" />
              </div>
              <h2 :class="`text-xl ${LOGIN_TITLE_CLASS}`">
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
