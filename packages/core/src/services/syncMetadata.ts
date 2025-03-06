import type { ITelegramClientAdapter } from '../types'

import { useLogger } from '@tg-search/common'
import { deleteAllChats, deleteAllFolders, updateChat, updateFolder } from '@tg-search/db'

const logger = useLogger()

export interface MetadataSyncOptions {
  onProgress?: (progress: number, message: string, metadata?: Record<string, any>) => void
}

export class MetadataSyncServices {
  constructor(private client: ITelegramClientAdapter) {}
  async syncChats(options: MetadataSyncOptions): Promise<any> {
    let processed_chats_count = 0
    let processed_folders_count = 0
    const { onProgress } = options
    onProgress?.(5, '开始同步...', { totalChats: 0, totalFolders: 0, processedChats: 0, processedFolders: 0 })
    logger.debug('同步服务调用')
    await deleteAllFolders()
    onProgress?.(10, '开始清理文件夹...')
    await deleteAllChats()
    onProgress?.(15, '开始清理会话...')
    const newFolders = await this.client.getFolders()
    onProgress?.(20, '获取文件夹...', { totalChats: 0, totalFolders: newFolders.length, processedChats: 0, processedFolders: 0 })
    for (const folder of newFolders) {
      try {
        const result = await updateFolder(folder)

        if (!result || result.length === 0) {
          logger.warn(`文件夹 ${folder.title} 同步失败`)
        }
        else {
          processed_folders_count++
        }
      }
      catch (error) {
        logger.withError(error).warn(`同步文件夹失败: ${folder.title}`)
      }
    }
    onProgress?.(50, '同步文件夹完成', { totalChats: 0, totalFolders: newFolders.length, processedChats: processed_chats_count, processedFolders: processed_folders_count })
    const newChats = await this.client.getDialogs()
    onProgress?.(60, '获取会话...', { totalChats: newChats.length, totalFolders: newFolders.length, processedChats: processed_chats_count, processedFolders: processed_folders_count })
    for (const chat of newChats) {
      try {
        const reslut = await updateChat(chat)
        if (!reslut || reslut.length === 0) {
          logger.warn(`会话 ${chat.title} 同步失败`)
        }
        else {
          processed_chats_count++
        }
      }
      catch (error) {
        logger.withError(error).warn(`同步会话失败: ${chat.title}`)
      }
    }
    onProgress?.(100, '同步会话完成', { totalChats: newChats.length, totalFolders: newFolders.length, processedChats: processed_chats_count, processedFolders: processed_folders_count })
  }
}
