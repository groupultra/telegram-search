import { stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import envPaths from 'env-paths'

import { afterEach, describe, expect, it } from 'vitest'

import { ensureProfile, profilesRoot, resolveProfilePaths, writeSession } from './profile'

afterEach(() => {
  delete process.env.TG_SEARCH_HOME
})

describe('named profiles', () => {
  it('uses the operating system application data directory by default', () => {
    delete process.env.TG_SEARCH_HOME

    expect(profilesRoot()).toBe(envPaths('telegram-search', { suffix: '' }).data)
  })

  it('uses default and isolates named profile paths', () => {
    process.env.TG_SEARCH_HOME = join(tmpdir(), 'tg-search-profile-test')
    const defaultProfile = resolveProfilePaths()
    const workProfile = resolveProfilePaths('work')

    expect(defaultProfile.root).toContain('/default')
    expect(workProfile.database).not.toBe(defaultProfile.database)
  })

  it('rejects path traversal names', () => {
    expect(() => resolveProfilePaths('../other')).toThrow()
  })

  it('stores sessions with mode 0600', async () => {
    process.env.TG_SEARCH_HOME = join(tmpdir(), `tg-search-profile-${Date.now()}`)
    const paths = await ensureProfile('secure')
    await writeSession(paths, 'secret')

    expect((await stat(paths.session)).mode & 0o777).toBe(0o600)
  })
})
