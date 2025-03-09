import type { ExportFormat, ExportMethod, ExportOptions } from '@tg-search/core'
import type { DatabaseNewChat } from '@tg-search/db'

import * as input from '@inquirer/prompts'
import { getConfig, useLogger } from '@tg-search/common'
import { ExportService } from '@tg-search/core'

import { TelegramCommand } from '../command'

const logger = useLogger()

/**
 * Export command to export messages from Telegram
 */
export class ExportCommand extends TelegramCommand {
  meta = {
    name: 'export',
    description: 'Export messages from Telegram',
    usage: '[options]',
    requiresConnection: true,
  }

  private async promptForOptions(options: Partial<ExportOptions>): Promise<ExportOptions> {
    const chats = await this.getClient().getDialogs()
    logger.debug(`获取到 ${chats.length} 个会话`)

    const chatChoices = chats.map((chat: DatabaseNewChat) => ({
      name: `[${chat.type}] ${chat.title} (${chat.messageCount} 条消息)`,
      value: chat.id,
    }))

    const chatId = options.chatId || await input.select({
      message: '请选择要导出的会话：',
      choices: chatChoices,
    })

    const chatMetadata = chats.find((c: DatabaseNewChat) => c.id === chatId)
    if (!chatMetadata) {
      throw new Error(`Chat not found: ${chatId}`)
    }

    const method = options.method || await input.select({
      message: '请选择导出方式：',
      choices: [
        { name: 'Takeout (推荐，可能需要等待)', value: 'takeout' },
        { name: 'GetMessage (立即导出，可能不完整)', value: 'getMessage' },
      ],
    }) as ExportMethod

    const format = options.format || await input.select({
      message: '请选择导出格式：',
      choices: [
        { name: 'Database', value: 'database' },
      ],
    }) as ExportFormat

    let exportPath = options.path
    if (format !== 'database') {
      exportPath = exportPath || await input.input({
        message: '请输入导出路径：',
        default: './export',
      })
    }

    const messageTypes = options.messageTypes || await input.checkbox({
      message: '请选择要导出的消息类型：',
      choices: [
        { name: '文本消息', value: 'text', checked: true },
        { name: '图片', value: 'photo' },
        { name: '文档', value: 'document' },
        { name: '视频', value: 'video' },
        { name: '贴纸', value: 'sticker' },
        { name: '其他', value: 'other' },
      ],
    })

    let { startTime, endTime } = options
    if (!startTime || !endTime) {
      const useTimeRange = await input.confirm({
        message: '是否设置时间范围？',
        default: false,
      })

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
    }

    const limit = options.limit || Number(await input.input({
      message: '请输入要导出的消息数量（0 表示全部）：',
      default: '0',
    }))

    // 增量导出选项
    const incremental = options.incremental !== undefined
      ? options.incremental
      : await input.confirm({
        message: '是否开启增量导出（仅导出上次导出后的新消息）？',
        default: false,
      })

    let minId
    let maxId
    if (!incremental) {
      const useCustomIds = await input.confirm({
        message: '是否设置自定义消息ID范围？',
        default: false,
      })

      if (useCustomIds) {
        minId = Number(await input.input({
          message: '请输入起始消息ID：',
          default: '0',
        }))

        const useMaxId = await input.confirm({
          message: '是否设置结束消息ID？',
          default: false,
        })

        if (useMaxId) {
          maxId = Number(await input.input({
            message: '请输入结束消息ID：',
            default: '0',
          }))
        }
      }
    }

    return {
      chatMetadata,
      chatId,
      method,
      format,
      path: exportPath,
      messageTypes,
      startTime,
      endTime,
      limit,
      batchSize: options.batchSize || getConfig().message.export.batchSize,
      incremental,
      minId: minId || options.minId,
      maxId: maxId || options.maxId,
    }
  }

  async execute(_args: string[], options: Partial<ExportOptions>): Promise<void> {
    const exportOptions = await this.promptForOptions(options)
    const exportService = new ExportService(this.getClient())

    logger.withFields({
      exportOptions,
    }).debug('Export options')

    logger.log('正在导出消息...')

    try {
      await exportService.exportMessages({
        ...exportOptions,
        onProgress: (progress: number, message: string) => {
          logger.log(message)
        },
      })
    }
    catch (error: any) {
      if (error?.message?.includes('FLOOD_WAIT')) {
        const waitSeconds = Number(error.message.match(/FLOOD_WAIT_(\d+)/)?.[1])
        if (waitSeconds) {
          const shouldWait = await input.confirm({
            message: `需要等待 ${waitSeconds} 秒才能继续导出，是否等待？`,
            default: true,
          })
          if (!shouldWait)
            throw error

          logger.log(`等待 ${waitSeconds} 秒...`)
          await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000))
          logger.log('继续导出...')
          await this.execute(_args, exportOptions)
        }
      }
      else {
        throw error
      }
    }
  }
}

// Register command
export default new ExportCommand()
