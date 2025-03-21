import { useLogger } from '@tg-search/common'

import { createExtensions } from './01-extensions'
import { createMessageIndexes } from './02-indexes'
import { migrateMessageTables } from './03-message-tables'
import { createFunctions } from './04-functions'

/**
 * Run all migrations in order
 */
export async function runMigrations() {
  const logger = useLogger()

  try {
    // Run migrations in order
    logger.log('正在运行扩展迁移...')
    await createExtensions()

    logger.log('正在运行索引迁移...')
    await createMessageIndexes()

    logger.log('正在运行消息表迁移...')
    await migrateMessageTables()

    logger.log('正在运行函数迁移...')
    await createFunctions()

    logger.log('所有迁移完成')
  }
  catch (error) {
    logger.withError(error).error('迁移失败')
    throw error
  }
}
