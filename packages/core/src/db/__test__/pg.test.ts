import { beforeEach, describe, expect, it, vi } from 'vitest'

const execute = vi.fn()
const poolOn = vi.fn()
const migratePg = vi.fn()

vi.mock('pg', () => ({
  default: {
    Pool: class MockPool {
      on = poolOn
    },
  },
}))

vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle: vi.fn(() => ({
    execute,
  })),
}))

vi.mock('@proj-airi/drizzle-orm-browser-migrator/pg', () => ({
  migrate: migratePg,
}))

vi.mock('@tg-search/common', async () => {
  const actual = await vi.importActual<typeof import('@tg-search/common')>('@tg-search/common')
  return {
    ...actual,
    getDatabaseDSN: vi.fn(() => 'postgres://localhost/test'),
  }
})

vi.mock('@tg-search/schema', () => ({
  migrations: [],
}))

describe('db/pg', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('initPgDrizzle throws when no vector extension can be enabled', async () => {
    execute
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('vectors unsupported'))
      .mockRejectedValueOnce(new Error('vector unsupported'))

    const { initPgDrizzle } = await import('../pg')
    const logger: any = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      withError: vi.fn(() => logger),
      withFields: vi.fn(() => logger),
    }

    await expect(initPgDrizzle(logger, { database: {} } as any, { disableMigrations: true }))
      .rejects
      .toThrow('Failed to enable vector extension')

    expect(migratePg).not.toHaveBeenCalled()
  })
})
