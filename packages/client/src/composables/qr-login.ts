import type { BridgeAdapter } from '../types/bridge'

import { CoreEventType } from '@tg-search/core'
import { reactive } from 'vue'

export function createQrLogin(sendEvent: BridgeAdapter['sendEvent']) {
  let initialCodeTimeout: ReturnType<typeof setTimeout> | undefined
  const state = reactive({
    attemptId: '',
    status: 'idle' as 'idle' | 'loading' | 'scanning' | 'password' | 'submitting' | 'error' | 'expired',
    url: '',
    expires: 0,
    passwordInvalid: false,
  })

  function clear() {
    clearTimeout(initialCodeTimeout)
    Object.assign(state, { attemptId: '', status: 'idle', url: '', expires: 0, passwordInvalid: false })
  }

  function cancel() {
    const attemptId = state.attemptId
    clear()
    if (attemptId)
      sendEvent(CoreEventType.AuthQrCancel, { attemptId })
  }

  function start() {
    cancel()
    state.attemptId = crypto.randomUUID()
    state.status = 'loading'
    initialCodeTimeout = setTimeout(() => {
      const attemptId = state.attemptId
      clear()
      state.status = 'error'
      sendEvent(CoreEventType.AuthQrCancel, { attemptId })
    }, 60_000)
    sendEvent(CoreEventType.AuthLogin, { qrAttemptId: state.attemptId })
  }

  function receiveCode(data: { attemptId: string, url: string, expires: number }) {
    if (state.attemptId !== data.attemptId)
      return
    clearTimeout(initialCodeTimeout)
    Object.assign(state, { status: 'scanning', url: data.url, expires: data.expires })
  }

  function receiveState(data: { attemptId: string, status: 'password' | 'password-invalid' | 'error' | 'cancelled' | 'expired' }) {
    if (state.attemptId !== data.attemptId)
      return
    clearTimeout(initialCodeTimeout)
    state.url = ''
    if (data.status === 'cancelled') {
      clear()
      return
    }
    if (data.status === 'password-invalid') {
      state.passwordInvalid = true
      state.status = 'password'
      return
    }
    state.status = data.status
  }

  function submitPassword(password: string) {
    if (state.status !== 'password')
      return
    state.status = 'submitting'
    state.passwordInvalid = false
    sendEvent(CoreEventType.AuthQrPassword, { attemptId: state.attemptId, password })
  }

  return { state, start, cancel, clear, receiveCode, receiveState, submitPassword }
}
