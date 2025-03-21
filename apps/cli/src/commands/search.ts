import type { DatabaseMessageType, SearchOptions } from '@tg-search/db'

import * as input from '@inquirer/prompts'
import { useLogger } from '@tg-search/common'
import { EmbeddingService } from '@tg-search/core'
import { findSimilarMessages, getAllFolders, getChatsInFolder } from '@tg-search/db'

import { TelegramCommand } from '../command'

const logger = useLogger()

/**
 * Format message for display
 */
function formatMessage(message: any) {
  const time = new Date(message.createdAt).toLocaleString()
  const content = message.content?.slice(0, 100) + (message.content?.length > 100 ? '...' : '')
  const similarity = message.similarity ? ` (相似度: ${(message.similarity * 100).toFixed(2)}%)` : ''
  return `[${time}]${similarity}\n${content}`
}

/**
 * Search command to search messages
 */
export class SearchCommand extends TelegramCommand {
  meta = {
    name: 'search',
    description: 'Search messages in Telegram',
    usage: '[options]',
    requiresConnection: true,
  }

  async execute(_args: string[], _options: Record<string, any>): Promise<void> {
    // Get all folders
    const folders = await getAllFolders()
    logger.debug(`获取到 ${folders.length} 个文件夹`)
    const folderChoices = folders.map(folder => ({
      name: `${folder.emoji || ''} ${folder.title}`,
      value: folder.id,
    }))

    // Let user select folder
    const folderId = await input.select({
      message: '请选择要搜索的文件夹：',
      choices: folderChoices,
    })

    // Get all chats in folder
    const chats = await getChatsInFolder(Number(folderId))
    logger.debug(`获取到 ${chats.length} 个会话`)
    const chatChoices = chats.map(chat => ({
      name: `[${chat.type}] ${chat.title} (${chat.messageCount} 条消息)`,
      value: chat.id,
    }))

    // Let user select chat
    const chatId = await input.select({
      message: '请选择要搜索的会话：',
      choices: chatChoices,
    })

    // Get search query
    const query = await input.input({
      message: '请输入搜索关键词：',
    })

    // Get message type
    const type = await input.select({
      message: '请选择消息类型：',
      choices: [
        { name: '所有类型', value: undefined },
        { name: '文本消息', value: 'text' },
        { name: '图片', value: 'photo' },
        { name: '文档', value: 'document' },
        { name: '视频', value: 'video' },
        { name: '贴纸', value: 'sticker' },
        { name: '其他', value: 'other' },
      ],
    }) as DatabaseMessageType | undefined

    // Get time range
    const useTimeRange = await input.confirm({
      message: '是否设置时间范围？',
      default: false,
    })

    let startTime: Date | undefined
    let endTime: Date | undefined
    if (useTimeRange) {
      const startDateStr = await input.input({
        message: '请输入开始时间 (YYYY-MM-DD)：',
        default: '2000-01-01',
      })
      startTime = new Date(startDateStr)

      const endDateStr = await input.input({
        message: '请输入结束时间 (YYYY-MM-DD)：',
        default: new Date().toISOString().split('T')[0],
      })
      endTime = new Date(endDateStr)
    }

    // Get limit
    const limit = await input.input({
      message: '请输入要显示的结果数量：',
      default: '10',
    })

    // Initialize embedding service
    const embedding = new EmbeddingService()

    // Generate embedding for query
    logger.log('正在生成向量嵌入...')
    const queryEmbedding = await embedding.generateEmbeddings([query])
    logger.debug('向量嵌入生成完成')

    // Search messages
    logger.log('正在搜索消息...')
    const options: SearchOptions = {
      chatId: Number(chatId),
      type,
      startTime,
      endTime,
      limit: Number(limit),
    }

    const results = await findSimilarMessages(queryEmbedding[0], options)
    logger.log(`找到 ${results.length} 条相关消息：\n`)

    for (const message of results) {
      logger.log(formatMessage(message))
      logger.log('---')
    }
  }
}

// Register command
export default new SearchCommand()
