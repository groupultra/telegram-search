import { ref } from 'vue'

import { createWebsocketV2Context } from '../useConnection'

export function useAuthV2() {
  const isConnected = ref(false)
  const loading = ref(false)
  const error = ref<Error | null>(null)
  const needsVerificationCode = ref(false)
  const needsPassword = ref(false)
  const progress = ref<{
    step: 'LOGIN_STARTED' | 'CODE_REQUIRED' | 'CODE_RECEIVED' | 'PASSWORD_REQUIRED' | '2FA_RECEIVED'
    success?: boolean
  } | null>(null)

  const { sendEvent } = createWebsocketV2Context()

  // Handle login flow
  async function login(options: { phoneNumber: string, apiId?: number, apiHash?: string }): Promise<boolean> {
    loading.value = true
    error.value = null
    resetLoginState()

    try {
      sendEvent({
        type: 'auth:login',
        data: options,
      })
      return true
    }
    catch {
      error.value = new Error('Failed to send login request')
      loading.value = false
      return false
    }
  }

  // Submit verification code
  async function submitVerificationCode(code: string): Promise<boolean> {
    if (!needsVerificationCode.value) {
      error.value = new Error('No verification code requested')
      return false
    }

    try {
      sendEvent({
        type: 'auth:code',
        data: { code },
      })
      needsVerificationCode.value = false
      return true
    }
    catch {
      error.value = new Error('Failed to send verification code')
      return false
    }
  }

  // Submit 2FA password
  async function submitTwoFactorAuth(password: string): Promise<boolean> {
    if (!needsPassword.value) {
      error.value = new Error('No 2FA password requested')
      return false
    }

    loading.value = true
    error.value = null

    try {
      sendEvent({
        type: 'auth:password',
        data: { password },
      })
      return true
    }
    catch {
      loading.value = false
      error.value = new Error('Failed to send 2FA request')
      return false
    }
  }

  // Logout
  async function logout(): Promise<boolean> {
    loading.value = true
    error.value = null

    try {
      sendEvent({
        type: 'auth:logout',
        data: null,
      })
      return true
    }
    catch {
      loading.value = false
      error.value = new Error('Failed to send logout request')
      return false
    }
  }

  // Reset login state
  function resetLoginState(): void {
    needsVerificationCode.value = false
    needsPassword.value = false
    progress.value = null
    error.value = null
  }

  return {
    isConnected,
    loading,
    error,
    needsVerificationCode,
    needsPassword,
    progress,
    login,
    submitVerificationCode,
    submitTwoFactorAuth,
    logout,
    resetLoginState,
  }
}
