import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

const DEFAULT_DEFINE_NAME = '__UNPLUGIN_INFO__'

const safeExec = (command, cwd) => {
  try {
    return execSync(command, {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim()
  }
  catch {
    return null
  }
}

const readPackageInfo = (packageJsonPath) => {
  try {
    const content = readFileSync(packageJsonPath, 'utf8')
    const parsed = JSON.parse(content)
    return {
      name: parsed?.name ?? null,
      version: parsed?.version ?? null,
    }
  }
  catch {
    return {
      name: null,
      version: null,
    }
  }
}

const collectBuildInfo = (options) => {
  const cwd = options?.rootDir ?? process.cwd()
  const packageJsonPath = options?.packageJsonPath ?? resolve(cwd, 'package.json')
  const packageInfo = readPackageInfo(packageJsonPath)
  const commitHash = safeExec('git rev-parse HEAD', cwd)
  return {
    package: packageInfo,
    git: {
      branch: safeExec('git rev-parse --abbrev-ref HEAD', cwd),
      commitHash,
      commitShortHash: commitHash ? safeExec('git rev-parse --short HEAD', cwd) : null,
      commitTimestamp: commitHash ? Number.parseInt(safeExec('git show -s --format=%ct HEAD', cwd) ?? '', 10) || null : null,
    },
    buildTimestamp: Date.now(),
    buildTime: new Date().toISOString(),
    additional: { ...(options?.additional ?? {}) },
  }
}

const InfoPlugin = (options = {}) => {
  const defineName = options?.defineName ?? DEFAULT_DEFINE_NAME
  let info = collectBuildInfo(options)
  return {
    name: 'unplugin-info',
    enforce: 'pre',
    config() {
      info = collectBuildInfo(options)
      return {
        define: {
          [defineName]: JSON.stringify(info),
        },
      }
    },
    handleHotUpdate() {
      info = collectBuildInfo(options)
    },
  }
}

export { InfoPlugin as default }
