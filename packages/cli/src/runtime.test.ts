import { describe, expect, it } from 'vitest'

import { profileScopeId } from './runtime'

describe('pre-login profile scope', () => {
  it('derives a stable UUID without creating a placeholder account row', () => {
    // A raw profile path previously reached a PostgreSQL UUID comparison and
    // made even an empty local query fail before the first Telegram sync.
    const first = profileScopeId('/profiles/work')

    expect(first).toMatch(/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/)
    expect(profileScopeId('/profiles/work')).toBe(first)
    expect(profileScopeId('/profiles/personal')).not.toBe(first)
  })
})
