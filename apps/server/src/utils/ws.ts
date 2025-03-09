import { useLogger } from '@tg-search/common'

const logger = useLogger()

/**
 * WebSocket对等点接口
 */
export interface WebSocketPeer {
  id: string
  send: (data: unknown) => void
}

/**
 * WebSocket处理程序接口
 */
export interface WebSocketHandler {
  clients: Set<WebSocketPeer>
}

/**
 * WebSocket 消息类型接口
 */
export interface WsMessage {
  type: string
  data?: any
  error?: string
  message?: string
}

/**
 * 发送WebSocket消息
 * @param peer WebSocket对等点
 * @param message 消息对象
 */
export function sendMessage(peer: WebSocketPeer, message: WsMessage): void {
  try {
    peer.send(JSON.stringify(message))
  }
  catch (error) {
    logger.error('Failed to send WebSocket message', { error })
  }
}

/**
 * 广播WebSocket消息给所有客户端
 * @param handler WebSocket处理程序
 * @param message 消息对象
 * @param excludePeer 要排除的对等点
 */
export function broadcastMessage(
  handler: WebSocketHandler,
  message: WsMessage,
  excludePeer?: WebSocketPeer,
): void {
  for (const peer of handler.clients) {
    if (excludePeer && peer.id === excludePeer.id) {
      continue
    }
    sendMessage(peer, message)
  }
}

/**
 * 解析WebSocket消息
 * @param message WebSocket消息
 * @returns 解析后的消息对象或null
 */
export function parseMessage(message: any): WsMessage | null {
  try {
    // 处理不同的消息格式
    let text: string

    // h3.js的WebSocket消息对象有text()方法
    if (typeof message.text === 'function') {
      text = message.text()
    }
    // 直接是字符串的情况
    else if (typeof message === 'string') {
      text = message
    }
    // 消息有data属性的情况
    else if (message.data) {
      text = typeof message.data === 'string' ? message.data : JSON.stringify(message.data)
    }
    // 其他情况尝试直接解析
    else {
      text = JSON.stringify(message)
    }

    return JSON.parse(text)
  }
  catch (error) {
    logger.error('Failed to parse WebSocket message', { error })
    return null
  }
}

/**
 * 创建错误消息
 * @param type 消息类型
 * @param error 错误信息
 * @param message 可选的详细错误消息
 */
export function createErrorMessage(type: string, error: unknown, message?: string): WsMessage {
  return {
    type,
    error: error instanceof Error ? error.message : String(error),
    message,
  }
}

/**
 * 创建成功消息
 * @param type 消息类型
 * @param data 消息数据
 */
export function createSuccessMessage(type: string, data?: any): WsMessage {
  return {
    type,
    data,
  }
}
