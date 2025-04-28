import process from 'node:process'

export default {
  schema: './packages/core/src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_DSN,
  },
}
