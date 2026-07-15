import process from 'node:process'

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const bundle = await readFile(join(process.cwd(), 'dist/index.mjs'), 'utf8')
const importsExternalTelegramClient = /^import .* from ["']telegram["'];?$/mu.test(bundle)
const bundlesGramJsSessionClass = /node_modules\/\.pnpm\/telegram@[^/]+\/node_modules\/telegram\/sessions\/Abstract\.js/u.test(bundle)
const importsUnsupportedGramJsDirectory = /^import ["']telegram\/(?:network|sessions|tl)["'];?$/mu.test(bundle)

if (importsExternalTelegramClient && bundlesGramJsSessionClass) {
  throw new Error('CLI bundle mixes an external TelegramClient with an inlined GramJS Session class')
}

if (importsUnsupportedGramJsDirectory) {
  throw new Error('CLI bundle leaves a CommonJS GramJS directory import for the ESM runtime')
}
