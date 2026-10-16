import process from 'node:process'

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { emitResult, emitStreamResult, normalizeRawArgs, resolveExportOutputPath, runCli } from './index'
import { resetOutputState } from './output'
import { ensureProfile, readProfileConfig, resolveProfilePaths } from './profile'

const temporaryDirectories: string[] = []
const originalExitCode = process.exitCode

afterEach(async () => {
  vi.restoreAllMocks()
  delete process.env.TG_SEARCH_HOME
  resetOutputState('text')
  process.exitCode = originalExitCode
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { force: true, recursive: true })))
})

function captureOutput() {
  const stdout = vi.spyOn(process.stdout, 'write').mockImplementation((() => true) as typeof process.stdout.write)
  const stderr = vi.spyOn(process.stderr, 'write').mockImplementation((() => true) as typeof process.stderr.write)
  return {
    stderr,
    stdout,
    stdoutText: () => stdout.mock.calls.map(call => String(call[0])).join(''),
    stdoutJson: () => JSON.parse(stdout.mock.calls.map(call => String(call[0])).join('')),
  }
}

describe('cLI command boundary', () => {
  it('resolves explicit export paths in the invoking process', () => {
    expect(resolveExportOutputPath('./telegram-2026', '/profile/exports')).toBe(
      resolve(process.cwd(), 'telegram-2026'),
    )
    expect(resolveExportOutputPath(undefined, '/profile/exports')).toBe('/profile/exports')
  })

  it('moves a global profile argument to the leaf command', () => {
    expect(normalizeRawArgs(['--profile', 'work', 'messages', 'query', '--json'])).toEqual([
      'messages',
      'query',
      '--profile=work',
      '--json',
    ])
  })

  it('normalizes explicit JSON boolean values at the leaf command', () => {
    expect(normalizeRawArgs(['--json=true', 'profile', 'list'])).toEqual([
      'profile',
      'list',
      '--json',
    ])
    expect(normalizeRawArgs(['profile', 'list', '--json=false'])).toEqual([
      'profile',
      'list',
      '--json=false',
    ])
    expect(normalizeRawArgs(['profile', 'list', '--json=1'])).toEqual([
      'profile',
      'list',
      '--json',
    ])
    expect(normalizeRawArgs(['profile', 'list', '--json=yes'])).toEqual([
      'profile',
      'list',
      '--json',
    ])
    expect(normalizeRawArgs(['profile', 'list', '--json='])).toEqual([
      'profile',
      'list',
      '--json',
    ])
    expect(normalizeRawArgs(['--no-json', 'daemon', 'status'])).toEqual([
      'daemon',
      'status',
      '--json=false',
    ])
    expect(normalizeRawArgs(['profile', 'list', '--json', 'false'])).toEqual([
      'profile',
      'list',
      '--json=false',
    ])
  })

  it('renders profile lists for people unless JSON is requested', async () => {
    const home = await mkdtemp(join(tmpdir(), 'telegram-search-cli-'))
    temporaryDirectories.push(home)
    process.env.TG_SEARCH_HOME = home
    await ensureProfile('default')
    await ensureProfile('work')
    const output = captureOutput()

    await runCli(['--profile=work', 'profile', 'list'])

    expect(output.stdoutText()).toBe('Profiles:\n  - default\n  - work\n')
  })

  it('keeps the stable envelope behind --json', async () => {
    const home = await mkdtemp(join(tmpdir(), 'telegram-search-cli-'))
    temporaryDirectories.push(home)
    process.env.TG_SEARCH_HOME = home
    await ensureProfile('default')
    await ensureProfile('work')
    const output = captureOutput()

    await runCli(['--profile=work', 'profile', 'list', '--json=1'])

    expect(output.stdoutJson()).toEqual({
      ok: true,
      data: { profiles: ['default', 'work'] },
      meta: { profile: 'work', source: 'local', execution: expect.objectContaining({ mode: 'cli', cli: expect.objectContaining({ artifactDigest: expect.stringMatching(/^[a-f0-9]{64}$/) }) }) },
    })
  })

  it('renders nested results and stream progress for people', async () => {
    const output = captureOutput()

    emitResult({
      ok: true,
      data: {
        messages: [{ id: 42, sender: { displayName: 'Ada' }, tags: [] }],
      },
    }, { profile: 'work', source: 'local' })
    await emitStreamResult((async function* () {
      yield { type: 'progress', imported: 2 }
      yield { type: 'completed', imported: 3 }
    })(), { profile: 'work', source: 'local' })

    expect(output.stdoutText()).toBe([
      'Messages:',
      '  -',
      '    Id: 42',
      '    Sender:',
      '      Display Name: Ada',
      '    Tags:',
      '      (none)',
      'Type: completed',
      'Imported: 3',
      '',
    ].join('\n'))
    expect(output.stderr.mock.calls.map(call => String(call[0])).join('')).toBe('Type: progress\nImported: 2\n')
  })

  it('escapes terminal controls and indents multiline human-readable values', () => {
    const output = captureOutput()

    emitResult({
      ok: true,
      data: {
        message: {
          sender: 'Ada\u001B[31m',
          text: 'first\u001B]8;;https://example.com\u0007link\u001B]8;;\u0007\rrewrite\nsecond',
        },
      },
    }, { profile: 'work', source: 'local' })

    expect(output.stdoutText()).toBe([
      'Message:',
      '  Sender: Ada\\x1b[31m',
      '  Text: first\\x1b]8;;https://example.com\\x07link\\x1b]8;;\\x07\\rrewrite',
      '    second',
      '',
    ].join('\n'))
  })

  it('writes human-readable failures once to stderr and exits non-zero', () => {
    const output = captureOutput()

    emitResult({
      ok: false,
      error: { code: 'INVALID_ARGUMENT', message: 'limit must be positive', retryable: false },
    }, { profile: 'work', source: 'local' })

    expect(output.stdoutText()).toBe('')
    expect(output.stderr.mock.calls.map(call => String(call[0])).join('')).toBe('INVALID_ARGUMENT: limit must be positive\n')
    expect(process.exitCode).toBe(1)
  })

  it('configures the selected named profile instead of default', async () => {
    const home = await mkdtemp(join(tmpdir(), 'telegram-search-cli-'))
    temporaryDirectories.push(home)
    process.env.TG_SEARCH_HOME = home
    const output = captureOutput()

    await runCli(['--profile=work', 'profile', 'configure', '--apiId', '123', '--apiHash', 'secret', '--json'])

    await expect(readProfileConfig(resolveProfilePaths('work'))).resolves.toMatchObject({ apiId: '123', apiHash: 'secret' })
    await expect(readProfileConfig(resolveProfilePaths('default'))).resolves.toEqual({})
    expect(output.stdoutJson()).toMatchObject({ ok: true, data: { profile: 'work' }, meta: { profile: 'work', source: 'local', execution: expect.objectContaining({ mode: 'cli', cli: expect.objectContaining({ artifactDigest: expect.stringMatching(/^[a-f0-9]{64}$/) }) }) } })
  })

  it('serializes a failed stream as ok=false and exits non-zero', async () => {
    const output = captureOutput()
    resetOutputState('json')

    await emitStreamResult((async function* () {
      yield {
        type: 'failed',
        error: { code: 'TAKEOUT_FAILED', message: 'Takeout failed', retryable: false },
      }
    })(), { profile: 'work', source: 'telegram' })

    expect(output.stdoutJson()).toMatchObject({
      ok: false,
      error: { code: 'TAKEOUT_FAILED' },
      meta: { profile: 'work', source: 'telegram' },
    })
    expect(process.exitCode).toBe(1)
  })

  it('keeps RPC errors structured and exits non-zero', () => {
    const output = captureOutput()
    resetOutputState('json')

    emitResult({
      ok: false,
      error: { code: 'INVALID_ARGUMENT', message: 'limit must be positive', retryable: false },
    }, { profile: 'work', source: 'local' })

    expect(output.stdoutJson()).toMatchObject({
      ok: false,
      error: { code: 'INVALID_ARGUMENT' },
      meta: { profile: 'work', source: 'local' },
    })
    expect(process.exitCode).toBe(1)
  })

  it('rejects a stream that ends without a terminal update', async () => {
    captureOutput()

    await expect(emitStreamResult((async function* () {
      yield { type: 'progress' }
    })(), { profile: 'work', source: 'local' })).rejects.toThrow('without a terminal')
  })
})
