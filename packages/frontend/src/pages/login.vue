<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { useAuthWs } from '../apis/useAuthWs' // 新版基于WebSocket的验证
import { useConfig } from '../apis/useConfig'
import { ConnectionStatus } from '../composables/useWebSocket'
import { ErrorCode } from '../types/error'

// 定义登录流程的各个步骤
type LoginStep = 'phone' | 'code' | 'code_2fa' | 'complete'

const { t } = useI18n()

// 登录状态类型定义
interface LoginState {
  // 基本状态
  isLoading: boolean
  isConnected: boolean
  error: string | null
  currentStep: LoginStep

  // 用户输入
  phoneNumber: string
  verificationCode: string
  twoFactorPassword: string

  // API设置
  showAdvancedSettings: boolean
  apiId: string
  apiHash: string
}

// 初始化登录状态
const state = ref<LoginState>({
  isLoading: false,
  isConnected: false,
  error: null,
  currentStep: 'phone',

  phoneNumber: '',
  verificationCode: '',
  twoFactorPassword: '',

  showAdvancedSettings: false,
  apiId: '',
  apiHash: '',
})

const router = useRouter()
const {
  checkStatus,
  login,
  loading,
  error: wsError,
  isConnected,
  needsVerificationCode,
  needsPassword,
  progress,
  connectionStatus,
  submitVerificationCode,
  submitTwoFactorAuth,
  resetLoginState,
} = useAuthWs() // 新版WebSocket API
const { config, getConfig } = useConfig()

// 登录成功后的重定向路径
const returnPath = ref('/')

// 根据当前步骤判断表单是否可提交
// const canSubmit = computed(() => {
//   const { currentStep, phoneNumber, verificationCode, twoFactorPassword } = state.value

//   if (currentStep === 'phone' && !phoneNumber)
//     return false
//   if (currentStep === 'code' && !verificationCode)
//     return false
//   if (currentStep === 'code_2fa' && (!verificationCode || !twoFactorPassword))
//     return false

//   return !loading.value
// })

// 计算当前步骤的展示状态
const needPhoneNumber = computed(() => state.value.currentStep === 'phone')
const needCode = computed(() => state.value.currentStep === 'code')
const needCode2FA = computed(() => state.value.currentStep === 'code_2fa')

// 监听WebSocket连接状态
watch(connectionStatus, (newStatus) => {
  if (newStatus === ConnectionStatus.CLOSED || newStatus === ConnectionStatus.CLOSING) {
    toast.error(t('pages.login.connection_status_close'))
  }
})

// 监听WebSocket错误
watch(wsError, (newError) => {
  if (newError) {
    state.value.error = newError.message
    if (newError.message === ErrorCode.NEED_TWO_FACTOR_CODE) {
      goToNextStep('code_2fa')
    }
  }
})

// 监听是否需要验证码
watch(needsVerificationCode, (newNeedsCode) => {
  if (newNeedsCode && state.value.currentStep !== 'code') {
    goToNextStep('code')
    toast.info(t('pages.login.enter_code'))
  }
})

// 监听进度信息
watch(progress, (newProgress) => {
  if (newProgress) {
    console.warn('收到进度更新:', newProgress)
    // 根据进度信息更新UI状态
    switch (newProgress.step) {
      case 'CODE_REQUIRED':
        goToNextStep('code')
        toast.info(t('pages.login.enter_code'))
        break
      case 'PASSWORD_REQUIRED':
        goToNextStep('code_2fa')
        toast.info(t('pages.login.enter_2fa_code'))
        break
    }
  }
})

// 监听WebSocket认证状态
watch(isConnected, (newConnected) => {
  state.value.isConnected = newConnected
  if (newConnected) {
    handleSuccessfulConnection()
  }
})

// 监听WebSocket loading状态
watch(loading, (newLoading) => {
  state.value.isLoading = newLoading
})

// 监听是否需要2FA密码
watch(needsPassword, (newNeedsPassword) => {
  console.warn('需要2FA密码状态变更:', newNeedsPassword)
  if (newNeedsPassword && state.value.currentStep !== 'code_2fa') {
    goToNextStep('code_2fa')
    toast.info(t('pages.login.alert_two_verify_code'))
  }
})

// 页面初始化
onMounted(async () => {
  await initializeLoginPage()
})

/**
 * 初始化登录页面
 */
async function initializeLoginPage() {
  // 获取重定向路径
  const { redirect } = router.currentRoute.value.query
  if (redirect && typeof redirect === 'string') {
    returnPath.value = redirect
  }

  // 获取配置并初始化
  await getConfig()
  initializeFromConfig()

  // 检查登录状态
  await checkLoginStatus()
}

/**
 * 从配置中初始化登录信息
 */
function initializeFromConfig() {
  if (config.value?.api?.telegram) {
    const { apiId, apiHash, phoneNumber } = config.value.api.telegram
    state.value.apiId = apiId || ''
    state.value.apiHash = apiHash || ''

    if (phoneNumber && !state.value.phoneNumber) {
      state.value.phoneNumber = phoneNumber
    }
  }
}

/**
 * 检查当前登录状态
 */
async function checkLoginStatus() {
  state.value.isLoading = true
  state.value.error = null

  try {
    const connected = await checkStatus()
    state.value.isConnected = connected

    if (connected) {
      handleSuccessfulConnection()
    }
  }
  catch (err) {
    console.error('Failed to check login status', err)
  }
  finally {
    state.value.isLoading = false
  }
}

/**
 * 开始登录流程 - 统一版
 */
async function startLogin() {
  const { phoneNumber, isLoading } = state.value
  if (!phoneNumber || isLoading)
    return

  state.value.isLoading = true
  state.value.error = null
  resetLoginState() // 确保重置登录状态

  try {
    const options = {
      phoneNumber,
      ...getApiOptions(),
    }

    await login(options)
    // 接下来的步骤由WebSocket消息触发
  }
  catch (err) {
    handleError(err, t('pages.login.login_failure'))
  }
  finally {
    state.value.isLoading = false
  }
}

/**
 * 提交验证码
 */
async function submitCode() {
  const { verificationCode, isLoading } = state.value
  if (!verificationCode || isLoading)
    return

  state.value.isLoading = true
  state.value.error = null

  try {
    await submitVerificationCode(verificationCode)
    // 结果会通过WebSocket回调处理
  }
  catch (err) {
    handleError(err, t('pages.login.verify_code_submit_error'))
  }
  finally {
    state.value.isLoading = false
  }
}

/**
 * 提交两步验证密码
 */
async function submitTwoFactorPassword() {
  const { twoFactorPassword, isLoading } = state.value
  if (!twoFactorPassword || isLoading)
    return

  state.value.isLoading = true
  state.value.error = null

  try {
    await submitTwoFactorAuth(twoFactorPassword)
    // 结果会通过WebSocket回调处理
  }
  catch (err) {
    handleError(err, t('pages.login.two_step_verify_failure'))
  }
  finally {
    state.value.isLoading = false
  }
}

/**
 * 获取API选项
 */
function getApiOptions() {
  if (!state.value.showAdvancedSettings)
    return {}

  return {
    apiId: Number(state.value.apiId) || (config.value?.api?.telegram?.apiId ? Number(config.value.api.telegram.apiId) : undefined),
    apiHash: state.value.apiHash || config.value?.api?.telegram?.apiHash,
  }
}

/**
 * 处理登录成功
 */
function handleSuccessfulConnection() {
  // 登录成功时记录日志 (只允许warn和error方法)
  console.warn('登录成功，准备重定向到', returnPath.value)
  toast.success(t('pages.login.connection_success'))
  state.value.isConnected = true
  goToNextStep('complete')

  // 延迟跳转，给用户一些视觉反馈
  setTimeout(() => {
    router.push(returnPath.value)
  }, 1500)
}

/**
 * 通用错误处理
 */
function handleError(err: unknown, defaultMessage: string, prefix = '') {
  if (err instanceof Error) {
    state.value.error = err.message
    toast.error(`${prefix}${err.message}`)
  }
  else {
    state.value.error = defaultMessage
    toast.error(defaultMessage)
  }
}

/**
 * 前进到指定的登录步骤
 */
function goToNextStep(step: LoginStep) {
  state.value.currentStep = step
}

/**
 * 返回上一步
 */
function goToPreviousStep() {
  const { currentStep } = state.value

  if (currentStep === 'code_2fa') {
    goToNextStep('code')
  }
  else if (currentStep === 'code') {
    goToNextStep('phone')
  }
}

/**
 * 重置登录流程
 */
function resetLogin() {
  Object.assign(state.value, {
    error: null,
    phoneNumber: '',
    verificationCode: '',
    twoFactorPassword: '',
    currentStep: 'phone',
  })
  resetLoginState()
}

/**
 * 处理登录表单提交
 */
function handleLogin() {
  const { currentStep } = state.value

  if (currentStep === 'phone') {
    startLogin()
  }
  else if (currentStep === 'code') {
    submitCode()
  }
  else if (currentStep === 'code_2fa') {
    submitTwoFactorPassword()
  }
}

/**
 * 切换高级设置显示
 */
function toggleAdvancedSettings() {
  state.value.showAdvancedSettings = !state.value.showAdvancedSettings
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12 dark:bg-gray-900 lg:px-8 sm:px-6">
    <div class="max-w-md w-full space-y-8">
      <!-- 标题 -->
      <div class="text-center">
        <h2 class="text-3xl text-gray-900 font-extrabold tracking-tight dark:text-white">
          {{ t('pages.login.connect_to_telegram') }}
        </h2>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {{ t('pages.login.connect_to_your_telegram') }}
        </p>
      </div>

      <div class="rounded-md bg-white px-6 py-8 shadow-md dark:bg-gray-800">
        <!-- 已连接状态 -->
        <div v-if="state.isConnected" class="rounded-md bg-green-50 p-4 dark:bg-green-900/30">
          <div class="flex">
            <div class="flex-shrink-0">
              <div class="i-carbon-checkmark-filled h-5 w-5 text-green-400" aria-hidden="true" />
            </div>
            <div class="ml-3">
              <p class="text-sm text-green-800 font-medium dark:text-green-200">
                {{ t('pages.login.connect_to_telegram_success') }}
              </p>
              <p class="mt-2 text-sm text-green-700 dark:text-green-300">
                {{ t('pages.login.returning') }}
              </p>
            </div>
          </div>
        </div>

        <!-- 登录表单 -->
        <div v-else>
          <form class="space-y-6" @submit.prevent="handleLogin">
            <!-- 错误信息显示 -->
            <div v-if="state.error" class="rounded-md bg-red-50 p-4 dark:bg-red-900/30">
              <div class="flex">
                <div class="flex-shrink-0">
                  <div class="i-carbon-warning-alt h-5 w-5 text-red-400" aria-hidden="true" />
                </div>
                <div class="ml-3">
                  <h3 class="text-sm text-red-800 font-medium dark:text-red-200">
                    {{ t('pages.login.connection_error') }}
                  </h3>
                  <div class="mt-2 text-sm text-red-700 dark:text-red-300">
                    <p>{{ state.error }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- 进度指示器 -->
            <div class="mb-4 flex justify-center">
              <div class="flex items-center space-x-4">
                <div class="flex flex-col items-center">
                  <div
                    class="h-8 w-8 flex items-center justify-center rounded-full"
                    :class="[
                      state.currentStep === 'phone' ? 'bg-blue-500 text-white'
                      : (state.currentStep === 'code' || state.currentStep === 'code_2fa' || state.currentStep === 'complete') ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
                    ]"
                  >
                    <div class="i-carbon-phone-filled h-4 w-4" />
                  </div>
                  <span class="mt-1 text-xs text-gray-600 dark:text-gray-400"> {{ t('pages.login.phone_number') }}</span>
                </div>
                <div class="h-0.5 w-6 bg-gray-200 dark:bg-gray-700" :class="{ 'bg-green-500 dark:bg-green-600': state.currentStep === 'code' || state.currentStep === 'code_2fa' || state.currentStep === 'complete' }" />
                <div class="flex flex-col items-center">
                  <div
                    class="h-8 w-8 flex items-center justify-center rounded-full"
                    :class="[
                      state.currentStep === 'code' ? 'bg-blue-500 text-white'
                      : (state.currentStep === 'code_2fa' || state.currentStep === 'complete') ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
                    ]"
                  >
                    <div class="i-carbon-chat h-4 w-4" />
                  </div>
                  <span class="mt-1 text-xs text-gray-600 dark:text-gray-400"> {{ t('pages.login.code') }}</span>
                </div>
                <div class="h-0.5 w-6 bg-gray-200 dark:bg-gray-700" :class="{ 'bg-green-500 dark:bg-green-600': state.currentStep === 'code_2fa' || state.currentStep === 'complete' }" />
                <div class="flex flex-col items-center">
                  <div
                    class="h-8 w-8 flex items-center justify-center rounded-full"
                    :class="[
                      state.currentStep === 'code_2fa' ? 'bg-blue-500 text-white'
                      : state.currentStep === 'complete' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
                    ]"
                  >
                    <div class="i-carbon-locked h-4 w-4" />
                  </div>
                  <span class="mt-1 text-xs text-gray-600 dark:text-gray-400"> {{ t('pages.login.password') }}</span>
                </div>
              </div>
            </div>

            <!-- 手机号输入框 (步骤1) -->
            <div v-if="needPhoneNumber">
              <label for="phone" class="block text-sm text-gray-700 font-medium dark:text-gray-300">
                {{ t('pages.login.telegram_phone_number') }}
              </label>
              <div class="mt-1">
                <input
                  id="phone"
                  v-model="state.phoneNumber"
                  name="phone"
                  type="tel"
                  required
                  class="block w-full appearance-none border border-gray-300 rounded-md px-3 py-2 shadow-sm dark:border-gray-600 focus:border-blue-500 dark:bg-gray-700 sm:text-sm dark:text-white focus:outline-none focus:ring-blue-500 placeholder-gray-400"
                  placeholder="+86 123456789"
                >
              </div>
              <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {{ t('pages.login.alert_telegram_phone_number') }}
              </p>
            </div>

            <!-- 验证码输入框 (步骤2) -->
            <div v-if="needCode || needCode2FA">
              <label for="code" class="block text-sm text-gray-700 font-medium dark:text-gray-300">
                {{ t('pages.login.code') }}
              </label>
              <div class="mt-1">
                <input
                  id="code"
                  v-model="state.verificationCode"
                  name="code"
                  type="text"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  required
                  :readonly="needCode2FA"
                  class="block w-full appearance-none border border-gray-300 rounded-md px-3 py-2 shadow-sm dark:border-gray-600 focus:border-blue-500 dark:bg-gray-700 sm:text-sm dark:text-white focus:outline-none focus:ring-blue-500 placeholder-gray-400"
                  :class="{ 'bg-gray-100 dark:bg-gray-600': needCode2FA }"
                  placeholder="{{ t('pages.login.placeholder_code') }}"
                >
              </div>
              <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {{ t('pages.login.sent_code_next_step') }}
              </p>
            </div>

            <!-- 两步验证密码输入框 (作为验证码的补充，同屏显示) -->
            <div v-if="needCode2FA">
              <label for="password" class="block text-sm text-gray-700 font-medium dark:text-gray-300">
                {{ t('pages.login.two_step_code') }}
              </label>
              <div class="mt-1">
                <input
                  id="password"
                  v-model="state.twoFactorPassword"
                  name="password"
                  type="password"
                  autocomplete="current-password"
                  required
                  class="block w-full appearance-none border border-gray-300 rounded-md px-3 py-2 shadow-sm dark:border-gray-600 focus:border-blue-500 dark:bg-gray-700 sm:text-sm dark:text-white focus:outline-none focus:ring-blue-500 placeholder-gray-400"
                  placeholder="{{t('pages.login.placeholder_two_step_code')}}"
                >
              </div>
              <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {{ t("pages.login.alert_two_step_code") }}
              </p>
            </div>

            <!-- 高级设置折叠面板 -->
            <div v-if="needPhoneNumber" class="mt-4">
              <div class="flex items-center justify-between">
                <button
                  type="button"
                  class="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400"
                  @click="toggleAdvancedSettings"
                >
                  <span class="mr-2">
                    <div
                      class="h-4 w-4 transition-transform" :class="[
                        state.showAdvancedSettings ? 'i-carbon-chevron-down' : 'i-carbon-chevron-right',
                      ]"
                    />
                  </span>
                  {{ t('pages.login.advanced_settings') }}
                </button>
              </div>

              <div v-if="state.showAdvancedSettings" class="animate-fadeIn mt-3 rounded-md bg-gray-50 p-4 dark:bg-gray-700/50">
                <div class="space-y-4">
                  <!-- API ID 输入 -->
                  <div>
                    <label for="apiId" class="block text-sm text-gray-700 font-medium dark:text-gray-300">
                      {{ t('pages.login.api_id') }}
                    </label>
                    <div class="mt-1">
                      <input
                        id="apiId"
                        v-model="state.apiId"
                        name="apiId"
                        type="text"
                        class="block w-full appearance-none border border-gray-300 rounded-md px-3 py-2 shadow-sm dark:border-gray-600 focus:border-blue-500 dark:bg-gray-700 sm:text-sm dark:text-white focus:outline-none focus:ring-blue-500 placeholder-gray-400"
                        :placeholder="config?.api?.telegram?.apiId || t('pages.login.alert_api_id')"
                      >
                    </div>
                  </div>

                  <!-- API Hash 输入 -->
                  <div>
                    <label for="apiHash" class="block text-sm text-gray-700 font-medium dark:text-gray-300">
                      {{ t('pages.login.api_hash') }}
                    </label>
                    <div class="mt-1">
                      <input
                        id="apiHash"
                        v-model="state.apiHash"
                        name="apiHash"
                        type="password"
                        class="block w-full appearance-none border border-gray-300 rounded-md px-3 py-2 shadow-sm dark:border-gray-600 focus:border-blue-500 dark:bg-gray-700 sm:text-sm dark:text-white focus:outline-none focus:ring-blue-500 placeholder-gray-400"
                        :placeholder="config?.api?.telegram?.apiHash ? '******' : t('pages.login.alert_api_hash')"
                      >
                    </div>
                  </div>

                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    {{ t('pages.login.alert_api') }}
                  </p>
                </div>
              </div>
            </div>

            <!-- 提交按钮 -->
            <div>
              <button
                type="submit"
                class="w-full flex justify-center border border-transparent rounded-md bg-blue-600 px-4 py-2 text-sm text-white font-medium shadow-sm hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <span v-if="state.isLoading" class="mr-2">
                  <div class="i-carbon-circle-dash inline-block h-4 w-4 animate-spin" />
                </span>
                {{ needPhoneNumber ? t("pages.login.send_code") : needCode ? t("pages.login.next_step") : t("pages.login.submit_code") }}
              </button>
            </div>

            <!-- 导航按钮 -->
            <div class="mt-2 flex justify-center space-x-4">
              <button
                v-if="!needPhoneNumber"
                type="button"
                class="inline-flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                @click="goToPreviousStep"
              >
                <div class="i-carbon-arrow-left mr-1 h-4 w-4" />
                {{ t("pages.login.go_back") }}
              </button>
              <button
                v-if="!needPhoneNumber"
                type="button"
                class="inline-flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                @click="resetLogin"
              >
                <div class="i-carbon-reset mr-1 h-4 w-4" />
                {{ t("pages.login.restart") }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-fadeIn {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
