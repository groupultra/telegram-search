import type { CursorPage, ExportInput, ExportUpdate, MessageRecord } from '@tg-search/protocol'

import { createHash } from 'node:crypto'
import { appendFile, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'

import { v4 as uuidv4 } from 'uuid'

import { monthKey } from '../utils/month-key'

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new DOMException('Export aborted', 'AbortError')
  }
}

export function createExportService(fetchPage: (cursor?: string) => Promise<CursorPage<MessageRecord>>) {
  return async function* exportMessages(input: ExportInput, signal?: AbortSignal): AsyncGenerator<ExportUpdate> {
    const taskId = uuidv4()
    yield { type: 'started', taskId }
    await mkdir(input.outputDir, { recursive: true })

    const files: string[] = []
    const manifestFiles: Array<{ file: string, count: number, sha256: string }> = []
    let exported = 0
    let cursor: string | undefined
    let current: { month: string, file: string, temporaryPath: string, count: number, hash: ReturnType<typeof createHash> } | undefined
    let pendingContent = ''

    async function flush() {
      if (!current || !pendingContent)
        return
      await appendFile(current.temporaryPath, pendingContent)
      pendingContent = ''
    }

    async function finalizeMonth() {
      if (!current)
        return undefined
      await flush()
      assertNotAborted(signal)
      await rename(current.temporaryPath, join(input.outputDir, current.file))
      files.push(current.file)
      manifestFiles.push({ file: current.file, count: current.count, sha256: current.hash.digest('hex') })
      const progress: ExportUpdate = { type: 'progress', taskId, file: current.file, exported: current.count }
      current = undefined
      return progress
    }

    try {
      do {
        assertNotAborted(signal)
        const page = await fetchPage(cursor)
        const pageItems = [...page.items]
          .sort((a, b) => a.timestamp - b.timestamp || a.chatId.localeCompare(b.chatId) || a.id.localeCompare(b.id))
        for (const message of pageItems) {
          const month = monthKey(message.timestamp, input.timeZone)
          if (current?.month !== month) {
            const progress = await finalizeMonth()
            if (progress)
              yield progress
            const file = `${month}.jsonl`
            const temporaryPath = join(input.outputDir, `.${file}.${taskId}.tmp`)
            await writeFile(temporaryPath, '', { mode: 0o600 })
            current = { month, file, temporaryPath, count: 0, hash: createHash('sha256') }
          }
          const line = `${JSON.stringify(message)}\n`
          current.count += 1
          current.hash.update(line)
          pendingContent += line
          exported += 1
        }
        await flush()
        cursor = page.nextCursor ?? undefined
      } while (cursor)

      const progress = await finalizeMonth()
      if (progress)
        yield progress
    }
    catch (error) {
      if (current)
        await rm(current.temporaryPath, { force: true })
      throw error
    }

    const manifest = JSON.stringify({
      version: 1,
      format: input.format,
      timeZone: input.timeZone,
      exported,
      files: manifestFiles,
    }, null, 2)
    const manifestTemporaryPath = join(input.outputDir, `.manifest.json.${taskId}.tmp`)
    await writeFile(manifestTemporaryPath, `${manifest}\n`, { mode: 0o600 })
    assertNotAborted(signal)
    await rename(manifestTemporaryPath, join(input.outputDir, 'manifest.json'))
    files.push('manifest.json')

    yield { type: 'completed', taskId, files: files.map(file => basename(file)), exported }
  }
}
