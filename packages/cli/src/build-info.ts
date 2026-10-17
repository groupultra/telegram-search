import type { RuntimeBuild } from '@tg-search/protocol'

import process from 'node:process'

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

export const CLI_VERSION = (createRequire(import.meta.url)('../package.json') as { version: string }).version

export function runtimeBuildInfo(moduleUrl: string = import.meta.url): RuntimeBuild {
  const artifact = fileURLToPath(moduleUrl)
  return {
    version: CLI_VERSION,
    artifact,
    artifactDigest: createHash('sha256').update(readFileSync(artifact)).digest('hex'),
    nodeVersion: process.version,
  }
}
