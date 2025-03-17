import { useDB, useLogger } from '@tg-search/common'
import { sql } from 'drizzle-orm'

/**
 * 创建嵌入模型表和相关索引
 */
export async function migrateEmbeddingTables() {
  const logger = useLogger()
  logger.log('正在迁移嵌入表...')

  // 创建嵌入模型表
  await useDB().execute(sql`
    CREATE TABLE IF NOT EXISTS embedding_models (
      id TEXT PRIMARY KEY,
      model_name TEXT NOT NULL,
      vector_dimensions INTEGER NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 创建更新时间触发器
  await useDB().execute(sql`
    DROP FUNCTION IF EXISTS update_embedding_models_timestamp() CASCADE
  `)

  await useDB().execute(sql`
    CREATE OR REPLACE FUNCTION update_embedding_models_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `)

  await useDB().execute(sql`
    CREATE TRIGGER update_embedding_models_timestamp
    BEFORE UPDATE ON embedding_models
    FOR EACH ROW
    EXECUTE FUNCTION update_embedding_models_timestamp()
  `)

  // 获取所有消息表
  const [{ table_names }] = await useDB().execute<{ table_names: string[] }>(sql`
    SELECT array_agg(table_name) as table_names
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name LIKE 'messages_%'
  `)

  if (!table_names) {
    logger.log('未找到消息表')
    return
  }

  // 为每个消息表创建对应的嵌入表
  for (const messagesTable of table_names) {
    const chatId = messagesTable.replace('messages_', '')
    const embeddingTable = `embeddings_${chatId}`

    logger.log(`正在为 ${messagesTable} 创建嵌入表...`)

    try {
      // 检查表是否存在
      const [{ exists }] = await useDB().execute<{ exists: boolean }>(sql`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = ${embeddingTable}
        )
      `)

      if (!exists) {
        // 删除旧的触发器和函数（如果存在）
        await useDB().execute(sql`
          DROP FUNCTION IF EXISTS ${sql.identifier(`update_${embeddingTable}_timestamp`)}() CASCADE
        `)

        // 创建触发器函数
        await useDB().execute(sql`
          CREATE OR REPLACE FUNCTION ${sql.identifier(`update_${embeddingTable}_timestamp`)}()
          RETURNS TRIGGER AS $$
          BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql
        `)

        // 创建嵌入表
        await useDB().execute(sql`
          CREATE TABLE IF NOT EXISTS ${sql.identifier(embeddingTable)} (
            id SERIAL PRIMARY KEY,
            chat_id BIGINT NOT NULL,
            message_id UUID NOT NULL,
            embedding vector(1536), -- 默认使用 OpenAI 的维度
            model_name TEXT NOT NULL,
            model_version TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT ${sql.identifier(`${embeddingTable}_message_id_unique`)} UNIQUE (message_id),
            CONSTRAINT ${sql.identifier(`${embeddingTable}_message_id_fk`)} 
              FOREIGN KEY (message_id) 
              REFERENCES ${sql.identifier(messagesTable)}(id)
              ON DELETE CASCADE
          )
        `)

        // 创建索引
        await useDB().execute(sql`
          CREATE INDEX IF NOT EXISTS ${sql.identifier(`${embeddingTable}_message_id_idx`)}
          ON ${sql.identifier(embeddingTable)} (message_id)
        `)

        await useDB().execute(sql`
          CREATE INDEX IF NOT EXISTS ${sql.identifier(`${embeddingTable}_embedding_idx`)}
          ON ${sql.identifier(embeddingTable)}
          USING ivfflat (embedding vector_cosine_ops)
          WITH (lists = 100)
        `)

        await useDB().execute(sql`
          CREATE INDEX IF NOT EXISTS ${sql.identifier(`${embeddingTable}_model_idx`)}
          ON ${sql.identifier(embeddingTable)} (model_name, model_version)
        `)

        await useDB().execute(sql`
          CREATE INDEX IF NOT EXISTS ${sql.identifier(`${embeddingTable}_updated_at_idx`)}
          ON ${sql.identifier(embeddingTable)} (updated_at DESC)
        `)

        // 创建触发器
        await useDB().execute(sql`
          CREATE TRIGGER ${sql.identifier(`${embeddingTable}_update_timestamp`)}
          BEFORE UPDATE ON ${sql.identifier(embeddingTable)}
          FOR EACH ROW
          EXECUTE FUNCTION ${sql.identifier(`update_${embeddingTable}_timestamp`)}()
        `)
      }
      else {
        // 表已存在，检查是否有updated_at列
        const [{ has_column }] = await useDB().execute<{ has_column: boolean }>(sql`
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = ${embeddingTable}
              AND column_name = 'updated_at'
          ) as has_column
        `)

        if (!has_column) {
          // 添加updated_at列
          await useDB().execute(sql`
            ALTER TABLE ${sql.identifier(embeddingTable)}
            ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          `)
        }

        // 检查是否已有触发器
        const [{ has_trigger }] = await useDB().execute<{ has_trigger: boolean }>(sql`
          SELECT EXISTS (
            SELECT 1
            FROM pg_trigger
            WHERE tgname = ${`${embeddingTable}_update_timestamp`}
          ) as has_trigger
        `)

        if (!has_trigger) {
          // 创建更新时间触发器
          await useDB().execute(sql`
            DROP FUNCTION IF EXISTS ${sql.identifier(`${embeddingTable}_update_timestamp`)}() CASCADE
          `)

          await useDB().execute(sql`
            CREATE OR REPLACE FUNCTION ${sql.identifier(`${embeddingTable}_update_timestamp`)}()
            RETURNS TRIGGER AS $$
            BEGIN
              NEW.updated_at = CURRENT_TIMESTAMP;
              RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
          `)

          await useDB().execute(sql`
            CREATE TRIGGER ${sql.identifier(`${embeddingTable}_update_timestamp`)}
            BEFORE UPDATE ON ${sql.identifier(embeddingTable)}
            FOR EACH ROW
            EXECUTE FUNCTION ${sql.identifier(`${embeddingTable}_update_timestamp`)}()
          `)
        }
      }

      logger.log(`表 ${embeddingTable} 创建完成`)
    }
    catch (error) {
      logger.withError(error).error(`创建表 ${embeddingTable} 失败: ${error instanceof Error ? error.message : String(error)}`)
      throw error
    }
  }

  logger.log('嵌入表迁移完成')
}
