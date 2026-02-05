import type { Logger } from '@guiiai/logg'
import type { ExtractData } from '@tg-search/core'

import type { BotManager } from '.'
import type { AccountState } from '../account'

import { CoreEventType } from '@tg-search/core'

type BotSendMessageData = ExtractData<(data: { chatId: string, content: string, parseMode?: 'HTML' | 'MarkdownV2' }) => void>

/**
 * Bridge CoreContext bot events to the BotManager.
 * Called once per account when account state is created.
 */
export function bridgeBotToAccount(
  botManager: BotManager,
  account: AccountState,
  accountId: string,
  logger: Logger,
) {
  if (!botManager.getBot()) {
    return
  }

  logger = logger.withContext('bot:bridge')

  account.ctx.emitter.on(CoreEventType.BotSendMessage, async (data: BotSendMessageData) => {
    try {
      await botManager.sendMessage(data.chatId, data.content, data.parseMode)
      logger.withFields({ accountId, chatId: data.chatId }).debug('Bot message sent via bridge')
    }
    catch (error) {
      logger.withError(error).error('Failed to send bot message via bridge')
    }
  })
}
