import { Api } from 'telegram'

import { MEDIA_PROCESS_BATCH_SIZE, MESSAGE_PROCESS_BATCH_SIZE } from '../constants'

/**
 * Check if a message contains media
 */
export function hasMedia(message: Api.Message): boolean {
  return !!(message.media && (
    message.media instanceof Api.MessageMediaPhoto
    || message.media instanceof Api.MessageMediaDocument
  ))
}

/**
 * Dynamically determine batch size based on message content
 */
export function getDynamicBatchSize(messages: Api.Message[]): number {
  const mediaCount = messages.filter(hasMedia).length
  const mediaRatio = messages.length > 0 ? mediaCount / messages.length : 0

  // If more than 50% of messages contain media, use a smaller batch
  return mediaRatio > 0.5 ? MEDIA_PROCESS_BATCH_SIZE : MESSAGE_PROCESS_BATCH_SIZE
}
