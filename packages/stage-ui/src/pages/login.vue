<script setup lang="ts">
import { useAuthStore, useWebsocketStore } from '@tg-search/client'
import { storeToRefs } from 'pinia'
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import Stepper from '../components/ui/Stepper.vue'

type LoginStep = 'phone' | 'code' | 'password' | 'complete'

const router = useRouter()

const authStore = useAuthStore()
const websocketStore = useWebsocketStore()
const { isLoggedIn } = storeToRefs(authStore)

const state = ref({
  isLoading: false,
  isConnected: false,
  currentStep: 'phone' as LoginStep,
  showAdvancedSettings: false,

  phoneNumber: websocketStore.getActiveSession()?.phoneNumber ?? '',
  verificationCode: '',
  twoFactorPassword: '',
})

const {
  login,
  submitCode,
  submitPassword,
} = authStore.handleAuth()

watch(() => authStore.auth.needCode, (value) => {
  if (value)
    state.value.currentStep = 'code'
})

watch(() => authStore.auth.needPassword, (value) => {
  if (value)
    state.value.currentStep = 'password'
})

const steps = [
  { step: 1, value: 'phone', title: '手机号', description: '输入您的 Telegram 手机号' },
  { step: 2, value: 'code', title: '验证码', description: '输入 Telegram 发送的验证码' },
  { step: 3, value: 'password', title: '二次验证', description: '输入两步验证密码' },
  { step: 4, value: 'complete', title: '完成', description: '登录成功' },
]

function redirectRoot() {
  toast.success('登录成功')
  router.push('/')
}

watch(isLoggedIn, (value) => {
  if (value) {
    redirectRoot()
  }
})

async function handleLogin() {
  state.value.isLoading = true

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
        state.value.currentStep = 'complete'
        break
    }
  }
  catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
  }
  finally {
    state.value.isLoading = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background">
    <div class="max-w-md w-full rounded-2xl bg-card p-10 shadow-2xl">
      <h1 class="mb-6 text-center text-3xl font-bold tracking-tight">
        Telegram 登录
      </h1>
      <Stepper :steps="steps" :current-step="state.currentStep" />
      <p class="mb-8 text-center text-lg text-complementary-600 font-medium">
        {{ steps.find(s => s.value === state.currentStep)?.description }}
      </p>

      <!-- 手机号码表单 -->
      <form v-if="state.currentStep === 'phone'" class="space-y-6" @submit.prevent="handleLogin">
        <div>
          <label for="phoneNumber" class="mb-2 block text-base text-primary-900 font-semibold">手机号码</label>
          <input
            id="phoneNumber"
            v-model="state.phoneNumber"
            type="tel"
            placeholder="+86 123 4567 8901"
            class="w-full border border-neutral-200 rounded-xl bg-neutral-100 px-5 py-4 text-xl transition focus:outline-none focus:ring-2 focus:ring-primary"
            required
          >
        </div>
        <button
          type="submit"
          class="w-full flex items-center justify-center rounded-xl bg-primary py-4 text-lg text-white font-bold transition hover:bg-primary/90"
          :disabled="state.isLoading"
        >
          <span v-if="state.isLoading" class="mr-2 animate-spin" />
          {{ state.isLoading ? '处理中...' : '登录' }}
        </button>
      </form>

      <!-- 验证码表单 -->
      <form v-if="state.currentStep === 'code'" class="space-y-6" @submit.prevent="handleLogin">
        <div>
          <label for="verificationCode" class="mb-2 block text-base text-primary-900 font-semibold">验证码</label>
          <input
            id="verificationCode"
            v-model="state.verificationCode"
            type="text"
            placeholder="请输入 Telegram 发送的验证码"
            class="w-full border border-neutral-200 rounded-xl bg-neutral-100 px-5 py-4 text-xl transition focus:outline-none focus:ring-2 focus:ring-primary"
            required
          >
          <p class="mt-2 text-sm text-complementary-600">
            请检查您的 Telegram 应用或短信
          </p>
        </div>
        <button
          type="submit"
          class="w-full flex items-center justify-center rounded-xl bg-primary py-4 text-lg text-white font-bold transition hover:bg-primary/90"
          :disabled="state.isLoading"
        >
          <span v-if="state.isLoading" class="mr-2 animate-spin" />
          {{ state.isLoading ? '处理中...' : '验证' }}
        </button>
      </form>

      <!-- 两步验证密码表单 -->
      <form v-if="state.currentStep === 'password'" class="space-y-6" @submit.prevent="handleLogin">
        <div>
          <label for="twoFactorPassword" class="mb-2 block text-base text-primary-900 font-semibold">两步验证密码</label>
          <input
            id="twoFactorPassword"
            v-model="state.twoFactorPassword"
            type="password"
            placeholder="请输入您的两步验证密码"
            class="w-full border border-neutral-200 rounded-xl bg-neutral-100 px-5 py-4 text-xl transition focus:outline-none focus:ring-2 focus:ring-primary"
            required
          >
        </div>
        <button
          type="submit"
          class="w-full flex items-center justify-center rounded-xl bg-primary py-4 text-lg text-white font-bold transition hover:bg-primary/90"
          :disabled="state.isLoading"
        >
          <span v-if="state.isLoading" class="mr-2 animate-spin" />
          {{ state.isLoading ? '处理中...' : '登录' }}
        </button>
      </form>

      <!-- 登录完成 -->
      <div v-if="state.currentStep === 'complete'" class="text-center">
        <div class="mb-4 text-3xl">
          🎉
        </div>
        <h2 class="text-xl text-primary-900 font-bold">
          登录成功！
        </h2>
        <p class="mt-2 text-lg text-complementary-600">
          您已成功登录 Telegram 账号
        </p>
        <button
          class="mt-6 w-full rounded-xl bg-primary py-4 text-lg text-white font-bold transition hover:bg-primary/90"
          @click="$router.push('/')"
        >
          进入主页
        </button>
      </div>
    </div>
  </div>
</template>
