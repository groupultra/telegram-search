import { Buffer } from 'node:buffer'
import { closeSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, unlinkSync, writeSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { cliError } from './cli-errors'

export function writeResultFile(path: string, chunks: Iterable<string>): { path: string, status: 'completed', bytes: number } {
  const destination = resolve(path)
  const partialPath = `${destination}.partial`
  let descriptor: number | undefined
  let createdPartial = false
  let bytes = 0
  try {
    if (lstatSync(destination, { throwIfNoEntry: false }))
      throw Object.assign(new Error('Output already exists'), { code: 'EEXIST' })
    mkdirSync(dirname(destination), { recursive: true, mode: 0o700 })
    descriptor = openSync(partialPath, 'wx', 0o600)
    createdPartial = true
    for (const chunk of chunks) {
      const buffer = Buffer.from(chunk)
      let offset = 0
      // A write may consume only part of its buffer; never publish truncated data.
      while (offset < buffer.length)
        offset += writeSync(descriptor, buffer, offset, buffer.length - offset)
      bytes += buffer.length
    }
    fsyncSync(descriptor)
    closeSync(descriptor)
    descriptor = undefined
    // Exclusive publication also protects a destination created during this write.
    linkSync(partialPath, destination)
    unlinkSync(partialPath)
    return { path: destination, status: 'completed', bytes }
  }
  catch (error) {
    if (descriptor !== undefined)
      closeSync(descriptor)
    const systemCode = error instanceof Error && 'code' in error ? error.code : undefined
    throw cliError({
      code: systemCode === 'EEXIST' ? 'OUTPUT_EXISTS' : 'OUTPUT_WRITE_FAILED',
      message: systemCode === 'EEXIST' ? 'Output or partial file already exists; choose a new path' : 'Could not finish writing the result file',
      retryable: false,
      details: { path: destination, ...(createdPartial ? { partialPath, status: 'partial' } : { status: 'not_started' }) },
    })
  }
}
