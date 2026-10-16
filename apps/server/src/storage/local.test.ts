import type { Logger } from '@guiiai/logg'

import { Buffer } from 'node:buffer'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { initLocalMediaStorage } from './local'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('local media bounded reads', () => {
  it('reads a range and checks size without loading the entire file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tg-media-test-'))
    directories.push(dir)
    const logger = { withFields: () => ({ log: () => {} }) } as unknown as Logger
    const provider = await initLocalMediaStorage(logger, { dir })
    if (!provider)
      throw new Error('Storage initialization failed')
    const location = await provider.save({ kind: 'photo', uuid: 'fixture' }, Buffer.from('abcdefghij'))
    expect(await provider.size(location)).toBe(10)
    expect(Buffer.from((await provider.loadRange(location, 3, 4))!).toString()).toBe('defg')
    expect(await provider.size({ kind: 'photo', path: '../outside' })).toBeNull()
    expect(await provider.loadRange({ kind: 'photo', path: '../outside' }, 0, 4)).toBeNull()
    const controller = new AbortController()
    controller.abort(new Error('cancelled'))
    await expect(provider.loadRange(location, 0, 4, controller.signal)).rejects.toThrow('cancelled')
  })
})
