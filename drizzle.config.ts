export default {
  schema: './packages/core/src/schemas/**/*.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: import.meta.env.DATABASE_URL,
  },
}
