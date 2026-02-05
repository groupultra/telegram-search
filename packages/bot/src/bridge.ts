import type { Logger } from '@guiiai/logg'
import type { CoreContext, ExtractData } from '@tg-search/core'

import type { BotRegistry } from './registry'

import { CoreEventType } from '@tg-search/core'

type BotSendMessageData = ExtractData<(data: { chatId: string, content: string, parseMode?: 'HTML' | 'MarkdownV2' }) => void>

const attachedContexts = new WeakSet<CoreContext>()

/**
 * Bind bot message bridge to a CoreContext.
 * Intended to be called once per account context.
 */
export function attachBotToContext(
  registry: BotRegistry,
  ctx: CoreContext,
  accountId: string,
  logger: Logger,
) {
  if (!registry.getBot()) {
    return
  }

  if (attachedContexts.has(ctx)) {
    return
  }

  attachedContexts.add(ctx)
  const scopedLogger = logger.withContext('bot:bridge')

  ctx.emitter.on(CoreEventType.BotSendMessage, async (data: BotSendMessageData) => {
    try {
      await registry.sendMessage(data.chatId, data.content, data.parseMode)
      scopedLogger.withFields({ accountId, chatId: data.chatId }).debug('Bot message sent via bridge')
    }
    catch (error) {
      scopedLogger.withError(error).error('Failed to send bot message via bridge')
    }
  })
}
