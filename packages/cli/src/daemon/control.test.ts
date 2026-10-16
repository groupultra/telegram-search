import process from 'node:process'

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { defineInvokeHandlers } from '@moeru/eventa'
import { createServer as createIpcServer } from '@moeru/eventa/adapters/unix-socket'
import { daemonContracts } from '@tg-search/protocol'
import { afterEach, expect, it, vi } from 'vitest'

import { runtimeBuildInfo } from '../build-info'
import { runCli } from '../index'
import { ensureProfile } from '../profile'
import { createDaemonDiagnostics } from './diagnostics'
import { socketPathFor } from './profile-state'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  process.exitCode = 0
})

it('runs public recover over temporary IPC and reports before and after health', async () => {
  const root = await mkdtemp(join(tmpdir(), 'tgs-control-'))
  vi.stubEnv('TG_SEARCH_HOME', root)
  const paths = await ensureProfile('test')
  const socket = await socketPathFor(paths)
  const health = createDaemonDiagnostics()
  const snapshot = () => ({ profile: 'test', pid: process.pid, startedAt: 1, state: 'ready' as const, health: health.snapshot(), build: runtimeBuildInfo() })
  const recover = vi.fn(async () => {
    health.recoveryStarted()
    health.transport('connected')
    health.authorization('authorized')
    health.recoveryFinished(true)
    return { ok: true as const, data: snapshot() }
  })
  const server = await createIpcServer(socket, (connection) => {
    defineInvokeHandlers(connection.context, daemonContracts, { status: snapshot, reload: snapshot, recover, stop: snapshot })
  })
  await writeFile(paths.daemon, JSON.stringify({ pid: process.pid, profile: 'test', socket, startedAt: 1 }))
  const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  try {
    await runCli(['daemon', 'recover', '--profile', 'test', '--json'])
    const result = JSON.parse(stdout.mock.calls.map(call => String(call[0])).join(''))
    expect(result).toMatchObject({ ok: true, data: { before: { health: { recovery: { attempts: 0 } } }, after: { state: 'ready', health: { transport: { state: 'connected' }, recovery: { attempts: 1, inProgress: false } } } } })
    expect(recover).toHaveBeenCalledTimes(1)
  }
  finally {
    await server.close()
    await rm(root, { recursive: true, force: true })
  }
})
