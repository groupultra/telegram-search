import process from 'node:process'

import { execFileSync } from 'node:child_process'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const cliRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const npm = join(dirname(process.execPath), process.platform === 'win32' ? 'npm.cmd' : 'npm')
const output = resolve(process.argv[2] ?? join(cliRoot, 'dist-release'))
const staging = join(output, 'package')
const manifest = JSON.parse(await readFile(join(cliRoot, 'package.json'), 'utf8'))
await mkdir(output, { recursive: true })
await rm(staging, { recursive: true, force: true })
await mkdir(staging)

// Workspace modules are bundled by tsdown; resolve catalog entries to the
// installed versions so the release has no monorepo-only dependency protocols.
const dependencies = {}
for (const [name, range] of Object.entries(manifest.dependencies)) {
  if (range.startsWith('workspace:'))
    continue
  const installed = JSON.parse(await readFile(join(cliRoot, 'node_modules', name, 'package.json'), 'utf8'))
  dependencies[name] = installed.version
}
await cp(join(cliRoot, 'dist'), join(staging, 'dist'), { recursive: true })
await cp(join(cliRoot, 'README.md'), join(staging, 'README.md'))
await cp(join(cliRoot, '../../LICENSE'), join(staging, 'LICENSE'))
await writeFile(join(staging, 'package.json'), `${JSON.stringify({
  name: manifest.name,
  version: manifest.version,
  type: 'module',
  license: 'AGPL-3.0-only',
  bin: manifest.bin,
  engines: { node: '>=24.13.0' },
  dependencies,
}, null, 2)}\n`)
execFileSync(npm, ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: staging, stdio: 'inherit' })
execFileSync(npm, ['shrinkwrap'], { cwd: staging, stdio: 'inherit' })
execFileSync(npm, ['pack', '--pack-destination', output], { cwd: staging, stdio: 'inherit' })
await rm(staging, { recursive: true, force: true })
