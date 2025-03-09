import type { DatabaseMessageType } from '@tg-search/db'

import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import * as input from '@inquirer/prompts'
import { useLogger } from '@tg-search/common'
import { EmbeddingService } from '@tg-search/core'
import { createMessages, getAllChats, refreshMessageStats, updateChat } from '@tg-search/db'
import { glob } from 'glob'
import { JSDOM } from 'jsdom'

import { TelegramCommand } from '../command'

const logger = useLogger()

interface ImportOptions {
  path?: string
  noEmbedding?: boolean
}

interface MessageData {
  id: number
  chatId: number
  type: DatabaseMessageType
  content: string
  createdAt: Date
  fromId?: number
  fromName?: string
  fromAvatar?: {
    type: 'photo' | 'emoji'
    value: string
    color?: string
  }
  links?: string[]
  replyToId?: number
  forwardFromChatId?: number
  forwardFromMessageId?: number
  views?: number
  forwards?: number
  mediaInfo?: {
    fileId: string
    type: string
    mimeType?: string
    fileName?: string
    fileSize?: number
    width?: number
    height?: number
    duration?: number
    thumbnail?: {
      fileId: string
      width: number
      height: number
    }
  }
}

interface TelegramChat {
  id: number
  type: string
  title: string
}

interface SelectedChat {
  id: number
  title: string
}

/**
 * Extract media info from message element
 */
function extractMediaInfo(element: Element) {
  // 检查图片
  const photo = element.querySelector('.media_photo')
  if (photo) {
    const status = photo.querySelector('.status.details')
    const dimensions = status?.textContent?.match(/(\d+)x(\d+)/)
    return {
      fileId: photo.querySelector('img')?.getAttribute('src') || '',
      type: 'photo',
      width: dimensions?.[1] ? Number(dimensions[1]) : undefined,
      height: dimensions?.[2] ? Number(dimensions[2]) : undefined,
    }
  }

  // 检查视频
  const video = element.querySelector('.media_video')
  if (video) {
    const status = video.querySelector('.status.details')
    const duration = status?.textContent?.match(/(\d+):(\d+)/)
    return {
      fileId: video.querySelector('video')?.getAttribute('src') || '',
      type: 'video',
      duration: duration ? Number(duration[1]) * 60 + Number(duration[2]) : undefined,
    }
  }

  // 检查文件
  const document = element.querySelector('.media_document')
  if (document) {
    const title = document.querySelector('.title.bold')
    const status = document.querySelector('.status.details')
    const size = status?.textContent?.match(/([\d.]+) (\w+)/)
    let fileSize: number | undefined
    if (size) {
      const [, value, unit] = size
      fileSize = Number(value)
      if (unit === 'KB')
        fileSize *= 1024
      else if (unit === 'MB')
        fileSize *= 1024 * 1024
      else if (unit === 'GB')
        fileSize *= 1024 * 1024 * 1024
    }
    return {
      fileId: document.querySelector('a')?.getAttribute('href') || '',
      type: 'document',
      fileName: title?.textContent?.trim(),
      fileSize,
    }
  }

  // 检查贴纸
  const sticker = element.querySelector('.media_photo')
  if (sticker?.classList.contains('sticker')) {
    const img = sticker.querySelector('img')
    return {
      fileId: img?.getAttribute('src') || '',
      type: 'sticker',
      width: img?.getAttribute('width') ? Number(img.getAttribute('width')) : undefined,
      height: img?.getAttribute('height') ? Number(img.getAttribute('height')) : undefined,
    }
  }

  return undefined
}

/**
 * Extract avatar info from element
 */
function extractAvatarInfo(element: Element) {
  const avatarElement = element.querySelector('.userpic')
  if (!avatarElement)
    return undefined

  // 检查是否是表情符号头像
  const emojiElement = avatarElement.querySelector('.emoji')
  if (emojiElement) {
    const color = avatarElement.getAttribute('data-color')
    return {
      type: 'emoji' as const,
      value: emojiElement.textContent || '👤',
      color: color || undefined,
    }
  }

  // 检查是否是图片头像
  const imgElement = avatarElement.querySelector('img')
  if (imgElement) {
    return {
      type: 'photo' as const,
      value: imgElement.getAttribute('src') || '',
    }
  }

  return undefined
}

/**
 * Determine message type from element
 */
function getMessageType(element: Element): DatabaseMessageType {
  if (element.querySelector('.photo_wrap'))
    return 'photo'
  if (element.querySelector('.video_file_wrap'))
    return 'video'
  if (element.querySelector('.document_wrap'))
    return 'document'
  if (element.querySelector('.sticker'))
    return 'sticker'
  return 'text'
}

/**
 * Parse date string from Telegram export
 * Format: DD.MM.YYYY HH:mm:ss UTC+HH:mm
 */
function parseTelegramDate(dateStr: string): Date {
  // 先解析基本日期时间
  const basicDate = new Date(dateStr.split(' UTC')[0].split('.').reverse().join('-'))

  // 解析时区
  const tzMatch = dateStr.match(/UTC([+-]\d{2}):(\d{2})/)
  if (!tzMatch)
    return basicDate

  const [, tzHour, tzMinute] = tzMatch
  const tzOffset = (Number(tzHour) * 60 + Number(tzMinute)) * (tzHour.startsWith('-') ? -1 : 1)

  // 调整时区
  basicDate.setMinutes(basicDate.getMinutes() - tzOffset)
  return basicDate
}

/**
 * Parse HTML message file and extract messages
 */
async function parseHtmlFile(filePath: string): Promise<MessageData[]> {
  const content = await readFile(filePath, 'utf-8')
  const dom = new JSDOM(content)
  const document = dom.window.document

  const messageElements = document.querySelectorAll('div.message.default.clearfix')

  // Convert NodeList to Array for functional iteration
  return Array.from(messageElements)
    .reduce((acc: MessageData[], element: Element) => {
      const id = Number(element.getAttribute('id')?.replace('message', ''))
      const body = element.querySelector('.body')
      if (!body)
        return acc

      // Get sender info
      const fromNameElement = body.querySelector('.from_name')
      const fromName = fromNameElement?.textContent?.trim()
      const fromId = fromNameElement?.getAttribute('data-peer-id')
      const fromAvatar = extractAvatarInfo(element)

      // Get message content
      const textElement = body.querySelector('.text')
      const mediaElement = body.querySelector('.media_wrap')
      let text = textElement?.textContent?.trim() || ''

      // 如果是媒体消息，尝试获取媒体描述
      if (mediaElement) {
        const mediaTitle = mediaElement.querySelector('.title.bold')?.textContent?.trim()
        const mediaDesc = mediaElement.querySelector('.description')?.textContent?.trim()
        if (mediaTitle) {
          text = text || `[${mediaTitle}]`
          if (mediaDesc && mediaDesc !== 'Not included, change data exporting settings to download.') {
            text += `: ${mediaDesc}`
          }
        }
      }

      // Get links
      const links = Array.from(body.querySelectorAll('a'))
        .map(a => a.getAttribute('href'))
        .filter((href): href is string => href !== null)

      // Get date
      const dateElement = body.querySelector('.date.details')
      const dateStr = dateElement?.getAttribute('title')

      // Get reply info
      const replyElement = body.querySelector('.reply_to.details')
      const replyToId = replyElement?.textContent
        ?.match(/In reply to (\d+)/)?.[1]

      // Get forward info
      const forwardElement = body.querySelector('.forwarded.body')
      const forwardFromChatId = forwardElement?.getAttribute('data-peer-id')
      const forwardFromMessageId = forwardElement?.getAttribute('data-post')

      // Get message stats
      const viewsElement = body.querySelector('.views')
      const views = viewsElement?.textContent ? Number(viewsElement.textContent.match(/\d+/)?.[0]) : undefined

      const forwardsElement = body.querySelector('.forwards')
      const forwards = forwardsElement?.textContent ? Number(forwardsElement.textContent.match(/\d+/)?.[0]) : undefined

      if (id && dateStr) {
        try {
          const createdAt = parseTelegramDate(dateStr)
          acc.push({
            id,
            chatId: 0, // Will be set from command line
            type: getMessageType(element),
            content: text,
            createdAt,
            fromId: fromId ? Number(fromId) : undefined,
            fromName,
            fromAvatar,
            links: links.length > 0 ? links : undefined,
            replyToId: replyToId ? Number(replyToId) : undefined,
            forwardFromChatId: forwardFromChatId ? Number(forwardFromChatId) : undefined,
            forwardFromMessageId: forwardFromMessageId ? Number(forwardFromMessageId) : undefined,
            views,
            forwards,
            mediaInfo: extractMediaInfo(element),
          })
        }
        catch (error) {
          logger.withError(error).warn(`解析消息 ${id} 的日期失败: ${dateStr}`)
        }
      }

      return acc
    }, [])
}

/**
 * Get chat info from HTML files
 */
async function getChatInfo(basePath: string): Promise<{ name: string, files: string[] }> {
  const files = await glob('**/*.html', {
    cwd: basePath,
    absolute: false,
  })

  if (files.length === 0) {
    throw new Error('未找到任何 HTML 文件')
  }

  logger.debug(`找到 HTML 文件: ${files.join(', ')}`)

  // Get info from first file to get chat name
  const filePath = join(basePath, files[0])
  const content = await readFile(filePath, 'utf-8')
  const dom = new JSDOM(content)
  const document = dom.window.document

  // Get chat name from title
  const title = document.querySelector('.page_header .text.bold')?.textContent?.trim()
    || document.querySelector('.page_header')?.textContent?.trim()
    || document.querySelector('title')?.textContent?.trim()
    || 'Unknown Chat'

  return {
    name: title,
    files,
  }
}

/**
 * Ask user whether to generate embeddings
 */
async function shouldGenerateEmbeddings(): Promise<boolean> {
  return input.confirm({
    message: '是否要生成向量嵌入（用于语义搜索）？',
    default: false,
  })
}

/**
 * Let user select target chat
 */
async function selectTargetChat(client: any, sourceChatName: string): Promise<SelectedChat> {
  // First ask if user wants to input chat ID directly
  const useDirectInput = await input.confirm({
    message: '是否直接输入目标会话 ID？',
    default: false,
  })

  if (useDirectInput) {
    const chatId = await input.input({
      message: '请输入目标会话 ID：',
      validate: (value) => {
        const id = Number(value)
        return !Number.isNaN(id) ? true : '请输入有效的会话 ID'
      },
    })

    // Get chat info to verify ID
    logger.debug('正在验证会话...')
    const chats = await client.getDialogs()
    const selectedChat = chats.find((c: TelegramChat) => c.id === Number(chatId))
    if (!selectedChat) {
      throw new Error(`找不到会话: ${chatId}`)
    }
    logger.debug(`已选择会话: ${selectedChat.title} (ID: ${chatId})`)
    return { id: Number(chatId), title: selectedChat.title }
  }

  // First try to get chats from database
  logger.debug('正在从数据库获取会话列表...')
  let chats = await getAllChats()
  logger.debug(`从数据库获取到 ${chats.length} 个会话`)

  // Ask if user wants to update chat list from Telegram
  if (chats.length === 0 || await input.confirm({
    message: '是否要从 Telegram 更新会话列表？',
    default: false,
  })) {
    logger.debug('正在从 Telegram 获取会话列表...')
    const telegramChats = await client.getDialogs()
    logger.debug(`从 Telegram 获取到 ${telegramChats.length} 个会话`)

    // Update chats in database
    for (const chat of telegramChats) {
      await updateChat({
        id: chat.id,
        type: chat.type,
        title: chat.title,
        lastSyncTime: new Date(),
      })
    }

    // Get updated chat list
    chats = await getAllChats()
  }

  // Ask how to select from list
  const method = await input.select({
    message: '请选择会话选择方式：',
    choices: [
      { name: '从列表中选择', value: 'list' },
      { name: '搜索会话', value: 'search' },
    ],
  })

  if (method === 'search') {
    const keyword = await input.input({
      message: '请输入搜索关键词：',
    })

    // Filter chats by keyword
    const filteredChats = chats.filter(chat =>
      chat.title.toLowerCase().includes(keyword.toLowerCase()),
    )

    if (filteredChats.length === 0) {
      throw new Error(`未找到包含 "${keyword}" 的会话`)
    }

    const chatChoices = filteredChats.map(chat => ({
      name: `[${chat.type}] ${chat.title} (${chat.id})`,
      value: chat,
    }))

    const selectedChat = await input.select({
      message: `请选择要导入 "${sourceChatName}" 到哪个会话：`,
      choices: chatChoices,
    })
    return { id: selectedChat.id, title: selectedChat.title }
  }

  // Default to list selection
  const chatChoices = chats.map(chat => ({
    name: `[${chat.type}] ${chat.title} (${chat.id})`,
    value: chat,
  }))

  const selectedChat = await input.select({
    message: `请选择要导入 "${sourceChatName}" 到哪个会话：`,
    choices: chatChoices,
  })
  return { id: selectedChat.id, title: selectedChat.title }
}

/**
 * Save messages to database in batch
 */
async function saveMessagesBatch(messages: MessageData[], embedding: EmbeddingService | null = null): Promise<{ total: number, failed: number }> {
  try {
    // Generate embeddings if needed
    let embeddings: number[][] | null = null
    if (embedding) {
      logger.debug('正在生成向量嵌入...')
      const contents = messages.map(m => m.content)
      embeddings = await embedding.generateEmbeddings(contents)
      logger.debug('向量嵌入生成完成')
    }

    // Convert messages to database format
    const dbMessages = messages.map((message, index) => ({
      id: message.id,
      chatId: message.chatId,
      type: message.type,
      content: message.content,
      fromId: message.fromId,
      fromName: message.fromName,
      fromAvatar: message.fromAvatar,
      embedding: embeddings?.[index],
      replyToId: message.replyToId,
      forwardFromChatId: message.forwardFromChatId,
      forwardFromMessageId: message.forwardFromMessageId,
      views: message.views,
      forwards: message.forwards,
      links: message.links,
      metadata: {
        hasLinks: message.links && message.links.length > 0,
        hasMedia: !!message.mediaInfo,
        isForwarded: !!message.forwardFromChatId,
        isReply: !!message.replyToId,
      },
      createdAt: message.createdAt,
    }))

    // Save messages in batch
    await createMessages(dbMessages)

    // Refresh message stats
    if (messages.length > 0) {
      await refreshMessageStats(messages[0].chatId)
    }

    return { total: messages.length, failed: 0 }
  }
  catch (error) {
    logger.withError(error).error('批量保存消息失败')
    return { total: 0, failed: messages.length }
  }
}

/**
 * Import command to import messages from HTML files
 */
export class ImportCommand extends TelegramCommand {
  meta = {
    name: 'import',
    description: 'Import messages from HTML files',
    usage: '[options]',
    options: [
      {
        flags: '-p, --path <path>',
        description: '导出文件所在的文件夹路径',
      },
      {
        flags: '--no-embedding',
        description: '不生成向量嵌入',
      },
    ],
    requiresConnection: true,
  }

  async execute(args: string[], options: ImportOptions): Promise<void> {
    const path = options.path

    if (!path) {
      throw new Error('Path is required. Use -p or --path to specify the path.')
    }

    try {
      const basePath = resolve(path)
      logger.debug(`正在搜索文件: ${basePath}`)

      // Get chat info and files from HTML
      const chatInfo = await getChatInfo(basePath)
      logger.debug(`找到聊天: ${chatInfo.name}，共 ${chatInfo.files.length} 个文件`)

      // Let user select target chat
      const selectedChat = await selectTargetChat(this.getClient(), chatInfo.name)
      logger.debug(`已选择会话: ${selectedChat.title} (ID: ${selectedChat.id})`)

      // Create or update chat in database
      await updateChat({
        id: selectedChat.id,
        type: 'user', // TODO: 从 Telegram API 获取正确的类型
        title: selectedChat.title,
        lastSyncTime: new Date(),
      })

      // Ask about embeddings
      const generateEmbeddings = options.noEmbedding !== undefined
        ? !options.noEmbedding
        : await shouldGenerateEmbeddings()

      // Initialize embedding service if needed
      const embedding = generateEmbeddings ? new EmbeddingService() : null

      let totalMessages = 0
      let failedEmbeddings = 0

      // Process each file
      for (const file of chatInfo.files) {
        const filePath = join(basePath, file)
        logger.debug(`正在处理文件: ${filePath}`)

        try {
          // Parse messages from file
          const messages = await parseHtmlFile(filePath)
          logger.debug(`从文件中解析出 ${messages.length} 条消息`)

          // Set chat ID for all messages
          for (const message of messages) {
            message.chatId = selectedChat.id
          }

          // Save messages in batch
          const result = await saveMessagesBatch(messages, embedding)
          totalMessages += result.total
          failedEmbeddings += result.failed

          logger.debug(`文件处理完成: ${file}`)
        }
        catch (error) {
          logger.withError(error).error(`处理文件失败: ${file}`)
        }
      }

      logger.log(`导入完成，共导入 ${totalMessages} 条消息，${failedEmbeddings} 条消息生成向量嵌入失败`)

      // Final refresh of message stats and chat metadata
      if (totalMessages > 0) {
        logger.debug('正在更新会话统计信息...')
        await refreshMessageStats(selectedChat.id)
        await updateChat({
          id: selectedChat.id,
          type: 'user',
          title: selectedChat.title,
          lastSyncTime: new Date(),
        })
      }
    }
    catch (error) {
      logger.withError(error).error('导入失败')
      throw error
    }
  }
}

// Register command
export default new ImportCommand()
