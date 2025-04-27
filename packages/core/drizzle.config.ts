import { initLogger } from '@tg-search/common'
import { getDatabaseDSN, initConfig, useConfig } from '@tg-search/common/composable'
import { defineConfig } from 'drizzle-kit'

initLogger()
initConfig()
const config = useConfig()

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: getDatabaseDSN(config),
  },
})
