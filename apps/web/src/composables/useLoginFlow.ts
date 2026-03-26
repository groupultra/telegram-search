import { useAccountStore, useAvatarStore, useSessionStore } from '@tg-search/client'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

export type LoginStep = 'phone' | 'code' | 'password' | 'complete'

export function useLoginFlow() {
  const { t } = useI18n()
  const router = useRouter()
  const route = useRoute()

  const accountStore = useAccountStore()
  const { activeSession } = storeToRefs(useSessionStore())
  const avatarStore = useAvatarStore()
  const { isReady } = storeToRefs(accountStore)

  const state = ref({
    currentStep: 'phone' as LoginStep,
    phoneNumber: '',
    verificationCode: '',
    twoFactorPassword: '',
  })

  accountStore.auth.needCode = false
  accountStore.auth.needPassword = false
  accountStore.auth.isLoading = false

  const {
    login,
    submitCode,
    submitPassword,
  } = accountStore.handleAuth()

  watch(() => accountStore.auth.needCode, (value) => {
    if (value) {
      accountStore.auth.isLoading = false
      state.value.currentStep = 'code'
    }
  })

  watch(() => accountStore.auth.needPassword, (value) => {
    if (value) {
      accountStore.auth.isLoading = false
      state.value.currentStep = 'password'
    }
  })

  watch(isReady, (value) => {
    if (value) {
      accountStore.auth.isLoading = false
      state.value.currentStep = 'complete'

      if (activeSession.value?.me?.id) {
        avatarStore.ensureUserAvatar(activeSession.value.me.id, undefined, true)
      }
    }
  }, { immediate: true })

  const steps = computed(() => [
    { step: 1, value: 'phone', title: t('login.phone'), description: t('login.phoneDescription') },
    { step: 2, value: 'code', title: t('login.code'), description: t('login.codeDescription') },
    { step: 3, value: 'password', title: t('login.password'), description: t('login.passwordDescription') },
    { step: 4, value: 'complete', title: t('login.complete'), description: t('login.completeDescription') },
  ])

  function redirectRoot() {
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : undefined
    router.push(redirect || '/sync')
  }

  async function handleLogin() {
    accountStore.auth.isLoading = true

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

  return {
    accountStore,
    state,
    steps,
    handleLogin,
    redirectRoot,
  }
}
