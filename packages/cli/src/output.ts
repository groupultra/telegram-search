import process from 'node:process'

export interface OutputEnvelope<T> {
  ok: true
  data: T
}

export function writeOutput<T>(data: T): void {
  process.stdout.write(`${JSON.stringify({ ok: true, data } satisfies OutputEnvelope<T>)}\n`)
}

export function writeProgress(data: unknown): void {
  process.stderr.write(`${JSON.stringify(data)}\n`)
}
