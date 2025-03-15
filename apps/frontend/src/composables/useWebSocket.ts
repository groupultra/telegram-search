import { onMounted, onUnmounted, ref } from 'vue'

import { API_BASE } from '../constants'

const WS_BASE = API_BASE.replace(/^http/, 'ws')

/**
 * WebSocket连接状态枚举
 */
export enum ConnectionStatus {
  CONNECTING = 'connecting',
  OPEN = 'open',
  CLOSING = 'closing',
  CLOSED = 'closed',
}

export type MessageHandler = (event: MessageEvent) => void

/**
 * WebSocket客户端composable
 */
export function useWebSocket(path: string) {
  const socket = ref<WebSocket | null>(null)
  const status = ref<ConnectionStatus>(ConnectionStatus.CLOSED)
  const error = ref<Error | null>(null)
  const reconnectAttempts = ref(0)
  const maxReconnectAttempts = 5
  const reconnectInterval = 1000 // 重连间隔，单位毫秒

  // 消息处理程序注册表
  const messageHandlers = ref<Set<MessageHandler>>(new Set())

  // 连接WebSocket
  function connect() {
    if (socket.value && [ConnectionStatus.OPEN, ConnectionStatus.CONNECTING].includes(status.value)) {
      console.warn('[WebSocket] 已经连接或正在连接，跳过重复连接')
      return // 如果已经连接或正在连接，则不再重复连接
    }

    try {
      console.warn(`[WebSocket] 开始连接 ${path}`)
      status.value = ConnectionStatus.CONNECTING
      const wsUrl = `${WS_BASE}${path}`

      socket.value = new WebSocket(wsUrl)

      socket.value.onopen = handleOpen
      socket.value.onclose = handleClose
      socket.value.onerror = handleError
      socket.value.onmessage = handleMessage
    }
    catch (err) {
      console.error('[WebSocket] 连接错误', err)
      error.value = err instanceof Error ? err : new Error(String(err))
      status.value = ConnectionStatus.CLOSED
      handleReconnect()
    }
  }

  // 处理WebSocket打开事件
  function handleOpen() {
    console.warn(`[WebSocket] 连接已打开 ${path}`)
    status.value = ConnectionStatus.OPEN
    error.value = null
    reconnectAttempts.value = 0
  }

  // 处理WebSocket关闭事件
  function handleClose(event: CloseEvent) {
    console.warn(`[WebSocket] 连接已关闭 ${path}`, event.code, event.reason)
    if (status.value !== ConnectionStatus.CLOSING) {
      // 如果不是主动关闭，则尝试重连
      status.value = ConnectionStatus.CLOSED
      handleReconnect()
    }
    else {
      status.value = ConnectionStatus.CLOSED
    }
  }

  // 处理WebSocket错误事件
  function handleError(_event: Event) {
    console.error(`[WebSocket] 连接错误 ${path}`)
    error.value = new Error('WebSocket连接错误')
    if (status.value !== ConnectionStatus.CLOSING) {
      status.value = ConnectionStatus.CLOSED
      handleReconnect()
    }
  }

  // 处理接收到的消息
  function handleMessage(event: MessageEvent) {
    // 遍历并调用所有注册的消息处理程序
    messageHandlers.value.forEach((handler) => {
      try {
        handler(event)
      }
      catch (err) {
        console.error('处理WebSocket消息时出错:', err)
      }
    })
  }

  // 自动尝试重连
  function handleReconnect() {
    const backoff = reconnectInterval * 1.5 ** reconnectAttempts.value // 指数退避策略

    if (reconnectAttempts.value < maxReconnectAttempts) {
      console.warn(`[WebSocket] 将在 ${backoff}ms 后尝试重连 (${reconnectAttempts.value + 1}/${maxReconnectAttempts})`)
      reconnectAttempts.value++
      setTimeout(() => {
        connect()
      }, backoff)
    }
    else {
      console.warn(`[WebSocket] 重连失败，已达到最大尝试次数 ${maxReconnectAttempts}`)
    }
  }

  // 发送消息
  function send(data: unknown) {
    if (socket.value && status.value === ConnectionStatus.OPEN) {
      socket.value.send(typeof data === 'string' ? data : JSON.stringify(data))
      return true
    }
    return false
  }

  // 关闭连接
  function disconnect() {
    if (socket.value && status.value === ConnectionStatus.OPEN) {
      status.value = ConnectionStatus.CLOSING
      socket.value.close()
    }
  }

  // 添加消息处理程序
  function addMessageHandler(handler: MessageHandler) {
    messageHandlers.value.add(handler)
  }

  // 移除消息处理程序
  function removeMessageHandler(handler: MessageHandler) {
    messageHandlers.value.delete(handler)
  }

  // 组件挂载时连接WebSocket
  onMounted(() => {
    connect()
  })

  // 组件卸载时关闭WebSocket
  onUnmounted(() => {
    disconnect()
  })

  return {
    socket,
    status,
    error,
    connect,
    disconnect,
    send,
    addMessageHandler,
    removeMessageHandler,
  }
}
