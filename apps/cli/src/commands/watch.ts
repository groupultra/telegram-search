import type { TelegramChat, TelegramMessage } from '@tg-search/core'

import * as input from '@inquirer/prompts'
import { useLogger } from '@tg-search/common'
import { createMessages } from '@tg-search/db'

import { TelegramCommand } from '../command'

const logger = useLogger()

interface WatchOptions {
  chatId?: number
  folderId?: number
}

/**
 * Watch command to monitor messages from Telegram
 */
export class WatchCommand extends TelegramCommand {
  meta = {
    name: 'watch',
    description: 'Monitor messages from Telegram',
    usage: '[options]',
    requiresConnection: true,
    isBackground: true,
  }

  private async watchChat(chatId: number, folderTitle: string): Promise<number> {
    // Get dialog info
    const result = await this.getClient().getPaginationDialogs(0, 100)
    const selectedDialog = result.chats.find((d: TelegramChat) => d.id === chatId)
    if (!selectedDialog) {
      logger.log('找不到该对话')
      return 0
    }

    logger.log(`开始监听 "${selectedDialog.title}" 的 "${folderTitle}" 文件夹...`)
    let count = 0

    // Setup message handler
    this.getClient().onMessage(async (message: TelegramMessage) => {
      // Only handle messages from selected chat
      if (message.chatId !== chatId)
        return

      // Only handle text messages
      if (message.type !== 'text') {
        logger.log(`[${new Date().toLocaleString()}] 跳过非文本消息: ${message.type}`)
        return
      }

      try {
        await createMessages({
          id: message.id,
          chatId: message.chatId,
          type: message.type,
          content: message.content,
          fromId: message.fromId,
          replyToId: message.replyToId,
          forwardFromChatId: message.forwardFromChatId,
          forwardFromMessageId: message.forwardFromMessageId,
          views: message.views,
          forwards: message.forwards,
          createdAt: message.createdAt,
        })
        count++
        logger.log(`[${new Date().toLocaleString()}] 已保存 ${count} 条新消息`)
      }
      catch (error) {
        logger.withError(error).error('保存消息失败:')
      }
    })

    // Keep the process running
    logger.log('按 Ctrl+C 停止监听')
    return count
  }

  async execute(_args: string[], options: WatchOptions): Promise<void> {
    // Get all folders
    const folders = await this.getClient().getFolders()
    logger.debug(`获取到 ${folders.length} 个文件夹`)
    const folderChoices = folders.map(folder => ({
      name: `${folder.emoji || ''} ${folder.title}`,
      value: folder.id,
    }))

    // Let user select folder
    const folderId = options.folderId || await input.select({
      message: '请选择要监听的文件夹：',
      choices: folderChoices,
    })

    // Get all chats in folder
    const dialogs = await this.getClient().getPaginationDialogs()
    logger.debug(`获取到 ${dialogs.chats.length} 个会话`)
    const chatChoices = dialogs.chats.map((dialog: TelegramChat) => ({
      name: `[${dialog.type}] ${dialog.title} (${dialog.unreadCount} 条未读)`,
      value: dialog.id,
    }))

    // Let user select chat
    const chatId = options.chatId || await input.select({
      message: '请选择要监听的会话：',
      choices: chatChoices,
    })

    const selectedFolder = folders.find(f => f.id === folderId)
    if (!selectedFolder) {
      logger.log('找不到选择的文件夹')
      return
    }

    await this.watchChat(chatId!, selectedFolder.title)
  }
}

// Register command
export default new WatchCommand()
