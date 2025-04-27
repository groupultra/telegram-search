import { initLogger } from '@tg-search/common'
import { getDatabaseDSN, useConfig } from '@tg-search/common/composable'
import { defineConfig } from 'drizzle-kit'

initLogger()
const config = useConfig()

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: getDatabaseDSN(config),
  },
})
