import type { Logger } from '@guiiai/logg'
import type { CoreDB, DBSelectBotScheduledTask } from '@tg-search/core'
import type { Bot } from 'grammy'

import { models } from '@tg-search/core'
import { Cron } from 'croner'

export interface Scheduler {
  loadTasks: () => Promise<void>
  addTask: (task: DBSelectBotScheduledTask) => void
  removeTask: (taskId: string) => void
  stopAll: () => void
}

export function createScheduler(
  getDB: () => CoreDB,
  bot: Bot,
  logger: Logger,
): Scheduler {
  logger = logger.withContext('bot:scheduler')
  const cronJobs = new Map<string, Cron>()

  function scheduleTask(task: DBSelectBotScheduledTask) {
    if (cronJobs.has(task.id)) {
      cronJobs.get(task.id)?.stop()
    }

    const job = new Cron(task.schedule, async () => {
      logger.withFields({ taskId: task.id, taskType: task.task_type }).log('Executing scheduled task')

      try {
        await executeTask(task)
        await models.botScheduledTaskModels.updateLastRunAt(getDB(), task.id)
      }
      catch (error) {
        logger.withError(error).error('Scheduled task execution failed')
      }
    })

    cronJobs.set(task.id, job)
    logger.withFields({ taskId: task.id, schedule: task.schedule }).log('Scheduled task registered')
  }

  async function executeTask(task: DBSelectBotScheduledTask) {
    const db = getDB()
    const account = await models.accountModels.findAccountByUUID(db, task.account_id)

    const accountData = account.expect('Account not found for scheduled task')
    const settings = accountData.settings
    const notifyChatId = settings?.bot?.notifyChatId

    if (!notifyChatId) {
      logger.withFields({ taskId: task.id }).warn('No notifyChatId configured for account')
      return
    }

    if (task.task_type === 'summary') {
      await executeSummaryTask(task, accountData.id, notifyChatId, settings?.embedding?.dimension)
    }
    else {
      logger.withFields({ taskType: task.task_type }).warn('Unknown task type')
    }
  }

  async function executeSummaryTask(
    task: DBSelectBotScheduledTask,
    accountId: string,
    notifyChatId: string,
    embeddingDimension = 1536,
  ) {
    const db = getDB()
    const config = task.config || {}
    const mode = config.summaryMode || 'daily'

    const now = Math.floor(Date.now() / 1000)
    const startTime = now - 86400

    const result = await models.chatMessageModels.retrieveMessages(
      db,
      logger,
      accountId,
      undefined,
      embeddingDimension,
      { text: undefined },
      { limit: 100, offset: 0 },
      {
        timeRange: { start: startTime },
        chatIds: config.chatIds,
      },
    )

    const messages = result.expect('Failed to retrieve messages for summary task')
    if (messages.length === 0) {
      throw new Error('No messages found for the scheduled summary period.')
    }

    const chatGroups = new Map<string, { name: string, count: number }>()
    for (const msg of messages) {
      const chatId = msg.in_chat_id || 'unknown'
      const existing = chatGroups.get(chatId)
      if (existing) {
        existing.count++
      }
      else {
        chatGroups.set(chatId, {
          name: msg.chat_name || chatId,
          count: 1,
        })
      }
    }

    const lines = Array.from(chatGroups.values())
      .sort((a, b) => b.count - a.count)
      .map(g => `  ${g.name}: ${g.count} messages`)

    const summaryText = [
      `Scheduled Summary (${mode}):`,
      `Total: ${messages.length} messages across ${chatGroups.size} chats\n`,
      ...lines,
    ].join('\n')

    await bot.api.sendMessage(notifyChatId, summaryText)
    logger.withFields({ accountId, messageCount: messages.length }).log('Summary sent')
  }

  return {
    async loadTasks() {
      const db = getDB()
      const tasks = await models.botScheduledTaskModels.findAllEnabled(db)
      logger.withFields({ count: tasks.length }).log('Loading scheduled tasks')
      for (const task of tasks) {
        scheduleTask(task)
      }
    },

    addTask(task) {
      scheduleTask(task)
    },

    removeTask(taskId) {
      const job = cronJobs.get(taskId)
      if (job) {
        job.stop()
        cronJobs.delete(taskId)
        logger.withFields({ taskId }).log('Scheduled task removed')
      }
    },

    stopAll() {
      for (const [id, job] of cronJobs) {
        job.stop()
        logger.withFields({ taskId: id }).debug('Stopped cron job')
      }
      cronJobs.clear()
    },
  }
}
