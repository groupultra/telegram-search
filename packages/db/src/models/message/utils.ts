import { useDB } from '@tg-search/common'
import { sql } from 'drizzle-orm'

import { useMessageTable } from '../../schema'

/**
 * Check for duplicate messages in a range
 */
export async function checkDuplicateMessages(chatId: number, id1: number, id2: number): Promise<{
  actualCount: number
  expectedCount: number
}> {
  const contentTable = await useMessageTable(chatId)
  const minId = Math.min(id1, id2)
  const maxId = Math.max(id1, id2)

  const [result] = await useDB()
    .select({ count: sql<number>`count(*)` })
    .from(contentTable)
    .where(sql`id >= ${minId} AND id <= ${maxId} AND chat_id = ${chatId}`)

  return {
    actualCount: Number(result.count),
    expectedCount: Math.abs(id2 - id1) + 1,
  }
}

/**
 * Get the maximum message ID for a chat
 * Used for incremental exports to determine where to start
 */
export async function findMaxMessageId(chatId: number): Promise<number | null> {
  try {
    const contentTable = await useMessageTable(chatId)
    const [result] = await useDB()
      .select({ maxId: sql<number>`MAX(id)` })
      .from(contentTable)
      .where(sql`chat_id = ${chatId}`)

    return result.maxId
  }
  catch {
    // Table might not exist yet
    return null
  }
}

/**
 * Get the minimum message ID for a chat
 */
export async function findMinMessageId(chatId: number): Promise<number | null> {
  try {
    const contentTable = await useMessageTable(chatId)
    const [result] = await useDB()
      .select({ minId: sql<number>`MIN(id)` })
      .from(contentTable)
      .where(sql`chat_id = ${chatId}`)

    return result.minId
  }
  catch {
    // Table might not exist yet
    return null
  }
}

/**
 * Get count of message by ID for chat
 */
export async function getMessageCount(chatId: number): Promise<number | null> {
  try {
    const contentTable = await useMessageTable(chatId)
    const [result] = await useDB()
      .select({ count: sql<number>`COUNT(id)` })
      .from(contentTable)
      .where(sql`chat_id = ${chatId}`)
    return result.count
  }
  catch {
    return null
  }
}
