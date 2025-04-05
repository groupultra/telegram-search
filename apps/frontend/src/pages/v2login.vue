<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import { toast } from 'vue-sonner'
import { useConnectionStore } from '../composables/useConnection'

const connectionStore = useConnectionStore()

type LoginStep = 'phone' | 'code' | 'password' | 'complete'

const state = ref({
  isLoading: false,
  isConnected: false,
  currentStep: 'phone' as LoginStep,
  showAdvancedSettings: false,

  phoneNumber: '',
  verificationCode: '',
  twoFactorPassword: '',

  apiId: '',
  apiHash: '',
})

const {
  needCode,
  needPassword,
  login,
  submitCode,
  submitPassword,
} = connectionStore.useAuth()

// Watch for state changes based on auth requirements
watchEffect(() => {
  if (needCode.value) {
    state.value.currentStep = 'code'
  }

  if (needPassword.value) {
    state.value.currentStep = 'password'
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

// Define steps for the stepper
const steps = [
  { step: 1, value: 'phone', title: '手机号', description: '输入您的 Telegram 手机号' },
  { step: 2, value: 'code', title: '验证码', description: '输入 Telegram 发送的验证码' },
  { step: 3, value: 'password', title: '二次验证', description: '输入两步验证密码' },
  { step: 4, value: 'complete', title: '完成', description: '登录成功' },
]
</script>

<template>
  <div class="mx-auto max-w-md rounded-lg bg-white p-6 shadow-md">
    <h1 class="mb-6 text-center text-2xl font-bold">
      Telegram 登录
    </h1>

    <!-- Custom Stepper -->
    <div class="mb-8 w-full">
      <div class="flex items-center">
        <template v-for="(step, index) in steps" :key="step.value">
          <!-- Step Item -->
          <div class="flex items-center gap-2">
            <!-- Step Indicator -->
            <div
              class="h-7 w-7 flex items-center justify-center border-2 rounded-full text-sm"
              :class="{
                'border-indigo-600 text-indigo-600': state.currentStep === step.value,
                'border-indigo-600 bg-indigo-600 text-white':
                  steps.findIndex(s => s.value === state.currentStep) > steps.findIndex(s => s.value === step.value),
                'border-gray-300 text-gray-500':
                  steps.findIndex(s => s.value === state.currentStep) < steps.findIndex(s => s.value === step.value),
              }"
            >
              <span v-if="step.value === 'complete' || steps.findIndex(s => s.value === state.currentStep) > steps.findIndex(s => s.value === step.value)">✓</span>
              <span v-else>{{ step.step }}</span>
            </div>

            <!-- Step Text -->
            <div>
              <div
                class="text-sm font-medium"
                :class="{
                  'text-gray-900': state.currentStep === step.value
                    || steps.findIndex(s => s.value === state.currentStep) > steps.findIndex(s => s.value === step.value),
                  'text-gray-500': steps.findIndex(s => s.value === state.currentStep) < steps.findIndex(s => s.value === step.value),
                }"
              >
                {{ step.title }}
              </div>
              <div
                class="text-xs"
                :class="{
                  'text-gray-600': state.currentStep === step.value
                    || steps.findIndex(s => s.value === state.currentStep) > steps.findIndex(s => s.value === step.value),
                  'text-gray-400': steps.findIndex(s => s.value === state.currentStep) < steps.findIndex(s => s.value === step.value),
                }"
              >
                {{ step.description }}
              </div>
            </div>
          </div>

          <!-- Separator (not after the last item) -->
          <div
            v-if="index < steps.length - 1"
            class="mx-2 h-0.5 flex-1"
            :class="{
              'bg-indigo-600': steps.findIndex(s => s.value === state.currentStep) > index,
              'bg-gray-300': steps.findIndex(s => s.value === state.currentStep) <= index,
            }"
          />
        </template>
      </div>
    </div>

    <!-- 手机号码表单 -->
    <form v-if="state.currentStep === 'phone'" class="space-y-4" @submit.prevent="handleLogin">
      <div>
        <label for="phoneNumber" class="block text-sm text-gray-700 font-medium">手机号码</label>
        <input
          id="phoneNumber"
          v-model="state.phoneNumber"
          type="tel"
          placeholder="+86 123 4567 8901"
          class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
          required
        >
        <p class="mt-1 text-sm text-gray-500">
          请输入完整的手机号，包括国家代码
        </p>
      </div>

      <div>
        <button
          type="button"
          class="text-sm text-indigo-600 hover:text-indigo-500"
          @click="state.showAdvancedSettings = !state.showAdvancedSettings"
        >
          {{ state.showAdvancedSettings ? '隐藏高级设置' : '显示高级设置' }}
        </button>
      </div>

      <div v-if="state.showAdvancedSettings" class="space-y-3">
        <div>
          <label for="apiId" class="block text-sm text-gray-700 font-medium">API ID</label>
          <input
            id="apiId"
            v-model="state.apiId"
            type="text"
            placeholder="API ID"
            class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
          >
        </div>

        <div>
          <label for="apiHash" class="block text-sm text-gray-700 font-medium">API Hash</label>
          <input
            id="apiHash"
            v-model="state.apiHash"
            type="text"
            placeholder="API Hash"
            class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
          >
        </div>
      </div>

      <div>
        <button
          type="submit"
          class="w-full flex justify-center border border-transparent rounded-md bg-indigo-600 px-4 py-2 text-sm text-white font-medium shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          :disabled="state.isLoading"
        >
          {{ state.isLoading ? '处理中...' : '发送验证码' }}
        </button>
      </div>
    </form>

    <!-- 验证码表单 -->
    <form v-if="state.currentStep === 'code'" class="space-y-4" @submit.prevent="handleLogin">
      <div>
        <label for="verificationCode" class="block text-sm text-gray-700 font-medium">验证码</label>
        <input
          id="verificationCode"
          v-model="state.verificationCode"
          type="text"
          placeholder="请输入 Telegram 发送的验证码"
          class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
          required
        >
        <p class="mt-1 text-sm text-gray-500">
          请检查您的 Telegram 应用或短信
        </p>
      </div>

      <div>
        <button
          type="submit"
          class="w-full flex justify-center border border-transparent rounded-md bg-indigo-600 px-4 py-2 text-sm text-white font-medium shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          :disabled="state.isLoading"
        >
          {{ state.isLoading ? '处理中...' : '验证' }}
        </button>
      </div>
    </form>

    <!-- 两步验证密码表单 -->
    <form v-if="state.currentStep === 'password'" class="space-y-4" @submit.prevent="handleLogin">
      <div>
        <label for="twoFactorPassword" class="block text-sm text-gray-700 font-medium">两步验证密码</label>
        <input
          id="twoFactorPassword"
          v-model="state.twoFactorPassword"
          type="password"
          placeholder="请输入您的两步验证密码"
          class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
          required
        >
      </div>

      <div>
        <button
          type="submit"
          class="w-full flex justify-center border border-transparent rounded-md bg-indigo-600 px-4 py-2 text-sm text-white font-medium shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          :disabled="state.isLoading"
        >
          {{ state.isLoading ? '处理中...' : '登录' }}
        </button>
      </div>
    </form>

    <!-- 登录完成 -->
    <div v-if="state.currentStep === 'complete'" class="text-center">
      <div class="mb-4 text-3xl">
        🎉
      </div>
      <h2 class="text-xl text-gray-900 font-medium">
        登录成功！
      </h2>
      <p class="mt-2 text-gray-600">
        您已成功登录 Telegram 账号
      </p>
      <button
        class="mt-6 w-full flex justify-center border border-transparent rounded-md bg-indigo-600 px-4 py-2 text-sm text-white font-medium shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        @click="$router.push('/')"
      >
        进入主页
      </button>
    </div>
  </div>
</template>
