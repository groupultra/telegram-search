import type { PluginOption } from 'vite'

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

export interface GitInfo {
  readonly branch: string | null
  readonly commitHash: string | null
  readonly commitShortHash: string | null
  readonly commitTimestamp: number | null
}

export interface PackageInfo {
  readonly name: string | null
  readonly version: string | null
}

export interface BuildInfo {
  readonly package: PackageInfo
  readonly git: GitInfo
  readonly buildTimestamp: number
  readonly buildTime: string
  readonly additional: Record<string, unknown>
}

export interface InfoPluginOptions {
  readonly rootDir?: string
  readonly packageJsonPath?: string
  readonly defineName?: string
  readonly additional?: Record<string, unknown>
}

const DEFAULT_DEFINE_NAME = '__UNPLUGIN_INFO__'

function safeExec(command: string, cwd: string): string | null {
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

function readPackageInfo(packageJsonPath: string): PackageInfo {
  try {
    const content = readFileSync(packageJsonPath, 'utf8')
    const parsed = JSON.parse(content) as { name?: string, version?: string }

    return {
      name: parsed.name ?? null,
      version: parsed.version ?? null,
    }
  }
  catch {
    return {
      name: null,
      version: null,
    }
  }
}

function collectBuildInfo(options: InfoPluginOptions): BuildInfo {
  const cwd = options.rootDir ?? process.cwd()
  const packageJsonPath = options.packageJsonPath ?? resolve(cwd, 'package.json')
  const packageInfo = readPackageInfo(packageJsonPath)

  const commitHash = safeExec('git rev-parse HEAD', cwd)
  const info: BuildInfo = {
    package: packageInfo,
    git: {
      branch: safeExec('git rev-parse --abbrev-ref HEAD', cwd),
      commitHash,
      commitShortHash: commitHash ? safeExec('git rev-parse --short HEAD', cwd) : null,
      commitTimestamp: commitHash ? Number.parseInt(safeExec('git show -s --format=%ct HEAD', cwd) ?? '', 10) || null : null,
    },
    buildTimestamp: Date.now(),
    buildTime: new Date().toISOString(),
    additional: { ...options.additional },
  }

  return info
}

export default function InfoPlugin(options: InfoPluginOptions = {}): PluginOption {
  const defineName = options.defineName ?? DEFAULT_DEFINE_NAME
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

export type { BuildInfo as Info, InfoPluginOptions as InfoOptions }
