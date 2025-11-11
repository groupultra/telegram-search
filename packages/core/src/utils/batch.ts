import { Api } from 'telegram'

import { MEDIA_PROCESS_BATCH_SIZE, MESSAGE_PROCESS_BATCH_SIZE } from '../constants'

/**
 * 检查消息是否包含媒体
 */
export function hasMedia(message: Api.Message): boolean {
  return !!(message.media && (
    message.media instanceof Api.MessageMediaPhoto
    || message.media instanceof Api.MessageMediaDocument
  ))
}

/**
 * 根据消息内容动态决定批次大小
 */
export function getDynamicBatchSize(messages: Api.Message[]): number {
  const mediaCount = messages.filter(hasMedia).length
  const mediaRatio = messages.length > 0 ? mediaCount / messages.length : 0

  // 如果超过 50% 的消息包含媒体，使用较小的批次
  return mediaRatio > 0.5 ? MEDIA_PROCESS_BATCH_SIZE : MESSAGE_PROCESS_BATCH_SIZE
}
