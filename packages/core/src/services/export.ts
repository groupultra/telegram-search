import type { CursorPage, ExportInput, ExportUpdate, MessageRecord } from '@tg-search/protocol'

import { createHash } from 'node:crypto'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'

import { v4 as uuidv4 } from 'uuid'

function monthKey(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().slice(0, 7)
}

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

    const messages: MessageRecord[] = []
    let cursor: string | undefined
    do {
      assertNotAborted(signal)
      const page = await fetchPage(cursor)
      messages.push(...page.items)
      cursor = page.nextCursor ?? undefined
    } while (cursor)

    messages.sort((a, b) => a.timestamp - b.timestamp || a.chatId.localeCompare(b.chatId) || a.id.localeCompare(b.id))
    const grouped = Map.groupBy(messages, message => monthKey(message.timestamp))
    const files: string[] = []
    const manifestFiles: Array<{ file: string, count: number, sha256: string }> = []

    for (const [month, monthMessages] of [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      assertNotAborted(signal)
      const file = `${month}.jsonl`
      const content = monthMessages.map(message => JSON.stringify(message)).join('\n') + (monthMessages.length ? '\n' : '')
      const temporaryPath = join(input.outputDir, `.${file}.${taskId}.tmp`)
      await writeFile(temporaryPath, content, { mode: 0o600 })
      assertNotAborted(signal)
      await rename(temporaryPath, join(input.outputDir, file))
      files.push(file)
      manifestFiles.push({
        file,
        count: monthMessages.length,
        sha256: createHash('sha256').update(content).digest('hex'),
      })
      yield { type: 'progress', taskId, file, exported: monthMessages.length }
    }

    const manifest = JSON.stringify({
      version: 1,
      format: input.format,
      exported: messages.length,
      files: manifestFiles,
    }, null, 2)
    const manifestTemporaryPath = join(input.outputDir, `.manifest.json.${taskId}.tmp`)
    await writeFile(manifestTemporaryPath, `${manifest}\n`, { mode: 0o600 })
    assertNotAborted(signal)
    await rename(manifestTemporaryPath, join(input.outputDir, 'manifest.json'))
    files.push('manifest.json')

    yield { type: 'completed', taskId, files: files.map(file => basename(file)), exported: messages.length }
  }
}
