import { useLogger } from '@tg-search/common'
import { deleteAllChats, deleteAllFolders, updateChat, updateFolder } from '@tg-search/db'

import { TelegramCommand } from '../command'

const logger = useLogger()

/**
 * Sync command to synchronize folders and chats from Telegram
 */
export class SyncCommand extends TelegramCommand {
  meta = {
    name: 'sync',
    description: 'Synchronize folders and chats from Telegram',
    requiresConnection: true,
  }

  async execute(_args: string[], _options: Record<string, any>): Promise<void> {
    logger.log('正在同步文件夹和会话信息...')

    try {
      // Clear existing data
      logger.debug('清理现有数据...')
      await deleteAllFolders()
      await deleteAllChats()
      logger.debug('数据清理完成')

      // Sync folders
      logger.log('正在同步文件夹...')
      const newFolders = await this.getClient().getFolders()
      logger.debug(`获取到 ${newFolders.length} 个文件夹`)

      for (const folder of newFolders) {
        try {
          const result = await updateFolder(folder)
          logger.debug(`已同步文件夹: ${folder.emoji || ''} ${folder.title} (ID: ${folder.id})`)
          if (!result || result.length === 0) {
            logger.warn(`文件夹 ${folder.title} 同步失败`)
          }
        }
        catch (error) {
          logger.withError(error).warn(`同步文件夹失败: ${folder.title}`)
        }
      }
      logger.log(`共同步了 ${newFolders.length} 个文件夹`)

      // Sync chats
      logger.log('正在同步会话...')
      const newChats = await this.getClient().getDialogs()
      logger.debug(`获取到 ${newChats.length} 个会话`)

      for (const chat of newChats) {
        try {
          logger.debug(`正在同步会话: ${JSON.stringify(chat)}`)
          const result = await updateChat(chat)
          logger.debug(`已同步会话: [${chat.type}] ${chat.title} (ID: ${chat.id})`)
          if (!result || result.length === 0) {
            logger.warn(`会话 ${chat.title} 同步失败`)
          }
        }
        catch (error) {
          logger.withError(error).warn(`同步会话失败: ${chat.title}`)
        }
      }
      logger.log(`共同步了 ${newChats.length} 个会话`)

      logger.log('同步完成')
    }
    catch (error) {
      logger.withError(error).error('同步失败')
      throw error
    }
  }
}

// Register command
export default new SyncCommand()
