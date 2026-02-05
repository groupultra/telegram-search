import type { CoreDB } from '../db'
import type { BotScheduledTaskConfig } from '../schemas/bot-scheduled-tasks'

import { eq } from 'drizzle-orm'

import { botScheduledTasksTable } from '../schemas/bot-scheduled-tasks'

export type DBSelectBotScheduledTask = typeof botScheduledTasksTable.$inferSelect
export type DBInsertBotScheduledTask = typeof botScheduledTasksTable.$inferInsert

async function findByAccountId(db: CoreDB, accountId: string): Promise<DBSelectBotScheduledTask[]> {
  return db
    .select()
    .from(botScheduledTasksTable)
    .where(eq(botScheduledTasksTable.account_id, accountId))
}

async function findAllEnabled(db: CoreDB): Promise<DBSelectBotScheduledTask[]> {
  return db
    .select()
    .from(botScheduledTasksTable)
    .where(eq(botScheduledTasksTable.enabled, true))
}

async function findById(db: CoreDB, id: string): Promise<DBSelectBotScheduledTask | undefined> {
  const rows = await db
    .select()
    .from(botScheduledTasksTable)
    .where(eq(botScheduledTasksTable.id, id))
    .limit(1)
  return rows[0]
}

async function create(
  db: CoreDB,
  accountId: string,
  taskType: string,
  schedule: string,
  config: BotScheduledTaskConfig = {},
): Promise<DBSelectBotScheduledTask> {
  const rows = await db
    .insert(botScheduledTasksTable)
    .values({
      account_id: accountId,
      task_type: taskType,
      schedule,
      config,
    })
    .returning()
  return rows[0]
}

async function update(
  db: CoreDB,
  id: string,
  data: Partial<Pick<DBInsertBotScheduledTask, 'schedule' | 'config' | 'enabled'>>,
): Promise<DBSelectBotScheduledTask | undefined> {
  const rows = await db
    .update(botScheduledTasksTable)
    .set({ ...data, updated_at: Date.now() })
    .where(eq(botScheduledTasksTable.id, id))
    .returning()
  return rows[0]
}

async function updateLastRunAt(db: CoreDB, id: string): Promise<void> {
  await db
    .update(botScheduledTasksTable)
    .set({ last_run_at: Date.now(), updated_at: Date.now() })
    .where(eq(botScheduledTasksTable.id, id))
}

async function remove(db: CoreDB, id: string): Promise<void> {
  await db
    .delete(botScheduledTasksTable)
    .where(eq(botScheduledTasksTable.id, id))
}

export const botScheduledTaskModels = {
  findByAccountId,
  findAllEnabled,
  findById,
  create,
  update,
  updateLastRunAt,
  remove,
}

export type BotScheduledTaskModels = typeof botScheduledTaskModels
