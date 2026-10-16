import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { resolveProfilePaths, writeProfileConfig, writeSession } from './profile'
import { inspectProfile } from './profile-inspection'

it('reports credential presence and source without returning secret values', async () => {
  const root = await mkdtemp(join(tmpdir(), 'tg-profile-inspect-'))
  const paths = { ...resolveProfilePaths('test'), root, config: join(root, 'config.json'), session: join(root, 'session') }
  try {
    await writeProfileConfig(paths, { apiId: '123', apiHash: 'private-profile-hash', remoteUrl: 'https://private.example.test' })
    await writeSession(paths, 'private-session-value')
    const result = await inspectProfile(paths, { TELEGRAM_API_HASH: 'unused-env-hash', TG_SEARCH_REMOTE_TOKEN: 'private-remote-token' })
    expect(result).toMatchObject({ mode: 'remote', credentials: { apiId: { present: true, source: 'profile' }, apiHash: { present: true, source: 'profile' }, remoteToken: { present: true, source: 'environment' }, session: { present: true, source: 'profile' } }, configured: { telegramRead: true, remoteRead: true }, verification: 'configuration-only' })
    expect(JSON.stringify(result)).not.toMatch(/private-|123|example\.test|unused-env/)
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

describe('profile inspection configuration gaps', () => {
  it('names missing remote credentials without claiming the endpoint is reachable', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tg-profile-inspect-'))
    try {
      const result = await inspectProfile({ ...resolveProfilePaths('test'), root, config: join(root, 'missing-config'), session: join(root, 'missing-session') }, { TG_SEARCH_REMOTE_URL: 'https://remote.example.test' })
      expect(result).toMatchObject({ mode: 'remote', configured: { remoteRead: false }, findings: [{ code: 'REMOTE_CREDENTIALS_MISSING', action: 'set_remote_token' }], verification: 'configuration-only' })
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
