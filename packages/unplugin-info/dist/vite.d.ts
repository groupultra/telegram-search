import type { PluginOption } from 'vite'

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

export default function InfoPlugin(options?: InfoPluginOptions): PluginOption

export type { BuildInfo as Info, InfoPluginOptions as InfoOptions }
