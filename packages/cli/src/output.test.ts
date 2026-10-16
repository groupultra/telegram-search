import { Buffer } from 'node:buffer'
import { chmod, lstat, mkdir, mkdtemp, readdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { formatOutput } from './output'
import { readOutputOptions } from './read-output'
import { writeResultFile } from './result-file'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

async function temporaryDirectory() {
  const root = await mkdtemp(join(tmpdir(), 'tg-result-file-'))
  directories.push(root)
  return root
}

const envelope = {
  ok: true as const,
  data: {
    items: [{ id: '2', chatId: '7', replyToId: '1', text: 'synthetic\nmessage', relation: { quote: 'synthetic' }, media: [{ type: 'photo' }] }],
    messages: [{ id: '1', text: 'synthetic parent' }],
    coverage: { references: { unresolved: 2 }, pagination: { stopReason: 'budget' } },
    nextCursor: 'older',
    context: { targetId: '2' },
  },
  next_cursor: 'older',
  meta: { profile: 'test', source: 'local' as const },
}

describe('bounded result output', () => {
  it('preserves every message and result field while splitting JSONL into individual records', () => {
    const lines = [...formatOutput(envelope, 'jsonl')].map(line => JSON.parse(line))
    expect(lines).toEqual([
      { type: 'result', ok: true, status: 'partial', data: { coverage: envelope.data.coverage, context: envelope.data.context, nextCursor: 'older' }, next_cursor: 'older', meta: envelope.meta, arrays: [{ key: 'items', count: 1 }, { key: 'messages', count: 1 }] },
      { type: 'item', key: 'items', index: 0, data: envelope.data.items[0] },
      { type: 'item', key: 'messages', index: 0, data: envelope.data.messages[0] },
      { type: 'completed', status: 'completed', ok: true },
    ])
  })

  it('retains relation fields in compact output and escapes embedded line breaks', () => {
    const chunks = [...formatOutput(envelope, 'compact')]
    expect(chunks).toHaveLength(4)
    expect(chunks[1]).toBe(`items[0]: ${JSON.stringify(envelope.data.items[0])}\n`)
    expect(JSON.parse(chunks[0].slice('Result: '.length))).toMatchObject({ data: { coverage: envelope.data.coverage, context: envelope.data.context } })
    expect(chunks[3]).toBe('Output: completed\n')
    expect(chunks[1].split('\n')).toHaveLength(2)
  })

  it('requires an explicit compatible format and defaults file output to JSONL', () => {
    expect(readOutputOptions(['messages', 'list', '--output-file', 'page.jsonl'])).toEqual({ format: 'jsonl', file: 'page.jsonl' })
    expect(readOutputOptions(['messages', 'list', '--format=compact'])).toEqual({ format: 'compact', file: undefined })
    expect(() => readOutputOptions(['messages', 'list', '--format', 'compact', '--json'])).toThrow('cannot be combined')
    expect(() => readOutputOptions(['profile', 'list', '--output-file', 'file'])).toThrow('read command')
    expect(() => readOutputOptions(['messages', 'list', '--output-file'])).toThrow('requires a value')
    expect(() => readOutputOptions(['messages', 'list', '--format=unrecognized'])).toThrow('--format must')
  })
})

describe('private result files', () => {
  it('creates private nested directories and files without changing an existing directory mode', async () => {
    const root = await temporaryDirectory()
    const existing = join(root, 'shared')
    await mkdir(existing)
    await chmod(existing, 0o755)
    const path = join(existing, 'private', 'nested', 'page.jsonl')
    const result = writeResultFile(path, formatOutput(envelope, 'jsonl'))
    const content = await readFile(path, 'utf8')
    expect(result).toEqual({ path, bytes: Buffer.byteLength(content), status: 'completed' })
    expect((await stat(existing)).mode & 0o777).toBe(0o755)
    expect((await stat(join(existing, 'private'))).mode & 0o777).toBe(0o700)
    expect((await stat(join(existing, 'private', 'nested'))).mode & 0o777).toBe(0o700)
    expect((await stat(path)).mode & 0o777).toBe(0o600)
    expect(content.trimEnd().split('\n').at(-1)).toBe('{"type":"completed","status":"completed","ok":true}')
    await expect(lstat(`${path}.partial`)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('never overwrites an existing final file or an unrelated partial file', async () => {
    const root = await temporaryDirectory()
    const path = join(root, 'existing.jsonl')
    await writeFile(path, 'unrelated final')
    expect(() => writeResultFile(path, ['new data'])).toThrow('already exists')
    expect(await readFile(path, 'utf8')).toBe('unrelated final')
    await expect(lstat(`${path}.partial`)).rejects.toMatchObject({ code: 'ENOENT' })
    const other = join(root, 'other.jsonl')
    await writeFile(`${other}.partial`, 'unrelated partial')
    expect(() => writeResultFile(other, ['new data'])).toThrow('already exists')
    expect(await readFile(`${other}.partial`, 'utf8')).toBe('unrelated partial')
    await expect(lstat(other)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('refuses symlink destinations and partial paths without touching their targets', async () => {
    const root = await temporaryDirectory()
    const target = join(root, 'target')
    await writeFile(target, 'unrelated target')
    const final = join(root, 'final.jsonl')
    await symlink(target, final)
    expect(() => writeResultFile(final, ['new data'])).toThrow('already exists')
    const partial = join(root, 'page.jsonl')
    await symlink(target, `${partial}.partial`)
    expect(() => writeResultFile(partial, ['new data'])).toThrow('already exists')
    expect(await readFile(target, 'utf8')).toBe('unrelated target')
    await expect(lstat(partial)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('leaves a clearly identified private partial file when serialization fails', async () => {
    const root = await temporaryDirectory()
    const path = join(root, 'interrupted.jsonl')
    function* brokenResult() {
      yield '{"type":"result","status":"partial"}\n'
      throw new Error('synthetic serialization failure')
    }
    expect(() => writeResultFile(path, brokenResult())).toThrow(expect.objectContaining({
      appError: expect.objectContaining({ code: 'OUTPUT_WRITE_FAILED', details: { path, partialPath: `${path}.partial`, status: 'partial' } }),
    }))
    expect(await readdir(root)).toEqual(['interrupted.jsonl.partial'])
    expect(await readFile(`${path}.partial`, 'utf8')).toBe('{"type":"result","status":"partial"}\n')
    expect((await stat(`${path}.partial`)).mode & 0o777).toBe(0o600)
  })
})
