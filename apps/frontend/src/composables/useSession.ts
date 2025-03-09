import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import { useAuth } from '../apis/useAuth'

/**
 * 用于管理 Telegram 会话状态的 composable
 * 包含重试机制和连接状态管理
 */
export function useSession() {
  // 重试机制参数
  const maxAttempts = 3
  const baseDelay = 5000
  const attempts = ref(0)

  // 连接状态
  const isCheckingConnection = ref(false)

  const router = useRouter()
  const { checkStatus, isConnected } = useAuth()

  // 指数退避策略
  const calculateDelay = () =>
    Math.min(baseDelay * 2 ** attempts.value, 30000)

  const resetAttempts = () => attempts.value = 0
  const recordAttempt = () => attempts.value++

  /**
   * 检查 Telegram 连接状态
   * 如果未连接，将重定向到登录页面
   */
  async function checkConnection(redirect = true): Promise<boolean> {
    if (isCheckingConnection.value)
      return isConnected.value

    isCheckingConnection.value = true

    try {
      isConnected.value = await checkStatus()

      if (!isConnected.value && redirect) {
        toast.error('未连接到 Telegram，请先登录')
        router.push('/login')
      }

      return isConnected.value
    }
    catch (error) {
      console.error('检查连接状态失败', error)

      if (redirect) {
        toast.error('检查连接状态失败，请重试')
      }

      return false
    }
    finally {
      isCheckingConnection.value = false
    }
  }

  /**
   * 尝试重新连接 Telegram
   * 使用指数退避策略进行重试
   */
  async function attemptReconnect(callback?: () => Promise<boolean>): Promise<boolean> {
    if (attempts.value >= maxAttempts) {
      toast.error(`重连失败，已达到最大重试次数 (${maxAttempts})`)
      resetAttempts()
      return false
    }

    try {
      // 如果提供了回调函数，使用它进行连接尝试
      // 否则，只检查连接状态
      const connected = callback ? await callback() : await checkStatus()

      if (connected) {
        isConnected.value = true
        resetAttempts()
        toast.success('已成功连接到 Telegram')
        return true
      }

      // 连接失败，记录重试次数
      recordAttempt()

      // 计算下次重试延迟
      const delay = calculateDelay()
      toast.info(`连接失败，${delay / 1000} 秒后重试 (${attempts.value}/${maxAttempts})`)

      // 设置延迟后重试
      setTimeout(() => attemptReconnect(callback), delay)
      return false
    }
    catch (error) {
      recordAttempt()
      console.error('重新连接失败', error)
      return false
    }
  }

  return {
    maxAttempts,
    calculateDelay,
    resetAttempts,
    recordAttempt,
    attempts,
    isCheckingConnection,
    isConnected,
    checkConnection,
    attemptReconnect,
  }
}
