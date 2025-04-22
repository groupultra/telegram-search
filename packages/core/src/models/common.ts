// https://github.com/moeru-ai/airi/blob/main/services/telegram-bot/src/models/common.ts

import type { chatMessagesTable } from '../db/schema'
import type { CoreMessage } from '../utils/message'

export function chatMessageToOneLine(botId: string, message: Omit<typeof chatMessagesTable.$inferSelect, 'content_vector_1536' | 'content_vector_768' | 'content_vector_1024'>, repliedToMessage?: Omit<typeof chatMessagesTable.$inferSelect, 'content_vector_1536' | 'content_vector_768' | 'content_vector_1024'>) {
  let userDisplayName = `User [${message.from_name}]`

  if (botId === message.from_id) {
    userDisplayName = 'Yourself'
  }

  if (message.is_reply) {
    if (repliedToMessage != null) {
      return `Message ID: ${message.platform_message_id || 'Unknown'} sent on ${new Date(message.created_at).toLocaleString()} ${userDisplayName} replied to ${repliedToMessage.from_name} with id ${repliedToMessage.platform_message_id} for content ${repliedToMessage.content} in same group said: ${message.content}`
    }

    return `Message ID: ${message.platform_message_id || 'Unknown'} sent on ${new Date(message.created_at).toLocaleString()} ${userDisplayName} replied to ${message.reply_to_name} with id ${message.reply_to_id} in same group said: ${message.content}`
  }

  return `Message ID: ${message.platform_message_id || 'Unknown'} sent on ${new Date(message.created_at).toLocaleString()} ${userDisplayName} sent in same group said: ${message.content}`
}

export async function telegramMessageToOneLine(botId: string, message: CoreMessage) {
  if (message == null)
    return ''

  const sentOn = new Date(message.createdAt).toLocaleString()
  let userDisplayName = `User [${message.fromName}]`

  if (botId === message.fromId)
    userDisplayName = 'Yourself'

  // TODO: Sticker and photo description
  // if (message.sticker != null) {
  //   const description = await findStickerDescription(message.sticker.file_id)
  //   return `Message ID: ${message.message_id || 'Unknown'} sent on ${sentOn} ${userDisplayName} sent in Group [${message.chat.title}] a sticker, and description of the sticker is ${description}`
  // }
  // if (message.photo != null) {
  //   const description = await findPhotoDescription(message.photo[0].file_id)
  //   return `Message ID: ${message.message_id || 'Unknown'} sent on ${sentOn} ${userDisplayName} sent in Group [${message.chat.title}] a photo, and description of the photo is ${description}`
  // }

  if (message.reply.isReply) {
    if (botId === message.reply.replyToId) {
      return `Message ID: ${message.platformMessageId || 'Unknown'} sent on ${sentOn} ${userDisplayName} replied to your previous message ${message.reply.replyToName} said: ${message.content}`
    }
    else {
      return `Message ID: ${message.platformMessageId || 'Unknown'} sent on ${sentOn} ${userDisplayName} replied to User [${message.reply.replyToName}] for content ${message.reply.replyToId} said: ${message.content}`
    }
  }

  return `Message ID: ${message.platformMessageId || 'Unknown'} sent on ${sentOn} ${userDisplayName} sent message: ${message.content}`
}
